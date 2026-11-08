// Optional integration test against a locally installed n8n CLI, with local fake services only.
import { createServer } from 'node:http';
import { createHmac, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { COLUMNS, sellerJob } from '../src/domain.mjs';

const cli = process.env.N8N_BIN;
if (!cli) throw new Error('Set N8N_BIN to the path of a locally installed n8n CLI. This test uses no real credentials.');
const folder = await mkdtemp(join(tmpdir(), 'mowakkid-smoke-'));
const workflow = JSON.parse(await readFile(new URL('../workflows/mowakkid.json', import.meta.url), 'utf8'));
const customer = '964' + '7' + '5'.repeat(9), business = '964' + '7' + '6'.repeat(9);
const now = Date.now(), stamp = String(Math.floor(now / 1000));
const sheet = Object.fromEntries(Object.entries(COLUMNS).map(([tab, cols]) => [tab, [[...cols]]]));
const metadata = { sheets: Object.keys(COLUMNS).map((title, sheetId) => ({ properties: { title, sheetId } })) };
const orders = ['A', 'B'].map(letter => sellerJob({ 'اسم الزبون': 'اختبار', 'المنتج': 'قميص', 'السعر بالدينار العراقي': '٢٥٠٠٠', 'رقم هاتف الزبون': customer }, letter.repeat(16), business, now).order);
for (const o of orders) sheet.Orders.push(COLUMNS.Orders.map(c => o[c]));
const [one, two] = orders.map(o => o.order_id);
const incoming = [];
function message(type, payload) { const m = { id: 'wamid.smoke.' + incoming.length, from: customer, timestamp: stamp, type, ...payload }; incoming.push(m); return m; }
message('text', { text: { body: 'تأكيد طلب ' + one } });
message('text', { text: { body: 'شكد التوصيل' } }); // valid Gemini intent
message('text', { text: { body: 'أني بأربيل مو ببغداد' } }); // simulated 429 fallback
message('interactive', { interactive: { type: 'button_reply', button_reply: { id: 'confirm:' + one, title: 'تأكيد' } } });
message('location', { location: { latitude: 36.19, longitude: 44.01 } });
incoming.push(incoming[0]); // duplicate after confirmed: must not change anything or send
message('text', { text: { body: 'تأكيد طلب ' + two } });
message('text', { text: { body: 'ما أريدها' } });
message('text', { text: { body: 'غيرت رأيي' } });
const phoneId = 'smoke-phone-id';
const secret = randomBytes(32).toString('hex');
const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneId }, messages: incoming } }] }] });
const headers = { 'x-hub-signature-256': 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex') };
const sent = [], aiCalls = [];
const server = createServer(async (req, res) => {
  try {
    let text = ''; for await (const part of req) text += part;
    const body = text ? JSON.parse(text) : {};
    const send = (value, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.url === '/meta') return send(metadata);
    if (req.url === '/state') return send({ valueRanges: ['Orders', 'Sessions', 'Messages'].map(tab => ({ values: sheet[tab] })) });
    if (req.url === '/commit' || req.url === '/delivery') {
      for (const request of body.requests) {
        const r = request.updateCells ?? request.appendCells;
        const tab = metadata.sheets.find(s => s.properties.sheetId === (r.sheetId ?? r.range.sheetId)).properties.title;
        const row = r.rows[0].values.map(v => v.userEnteredValue.numberValue ?? v.userEnteredValue.stringValue);
        if (request.appendCells) sheet[tab].push(row); else sheet[tab][r.range.startRowIndex] = row;
      }
      return send({ replies: body.requests.map(() => ({})) });
    }
    if (req.url === '/gemini') {
      aiCalls.push(body);
      if (aiCalls.length === 2) return send({ error: { code: 429 } }, 429);
      return send({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"intent":"delivery_question"}' }] } }] });
    }
    if (req.url === '/wa') { sent.push(body); return send({ messages: [{ id: 'wamid.sent.' + sent.length }] }); }
    return send({ error: 'unexpected mock path' }, 404);
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const paths = { 'Read tab metadata': '/meta', 'Read state tables': '/state', 'Commit state and outbox atomically': '/commit', 'Persist delivery status and errors': '/delivery', 'Gemini classify safely': '/gemini', 'Send WhatsApp reply': '/wa' };
const removed = new Set(['Seller order form', 'Validate seller and create order ID', 'Meta verify GET', 'Verify Meta challenge token', 'Return challenge or 403', 'Show seller customer link']);
workflow.nodes = workflow.nodes.filter(n => !removed.has(n.name) && !n.type.endsWith('.stickyNote'));
for (const [from, c] of Object.entries(workflow.connections)) {
  if (removed.has(from)) delete workflow.connections[from];
  else c.main = c.main.map(out => out.filter(e => !removed.has(e.node)));
}
for (const n of workflow.nodes) {
  if (n.name === 'WhatsApp POST immediate 200') { n.type = 'n8n-nodes-base.manualTrigger'; n.typeVersion = 1; n.parameters = {}; delete n.webhookId; }
  if (paths[n.name]) { n.parameters.url = base + paths[n.name]; n.parameters.authentication = 'none'; delete n.credentials; delete n.parameters.nodeCredentialType; delete n.parameters.genericAuthType; }
}
workflow.nodes.push({ id: 'smoke-seed', name: 'Seed signed mock webhook', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-740,260], parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{json:' + JSON.stringify({ headers }) + ',binary:{data:{data:' + JSON.stringify(Buffer.from(raw).toString('base64')) + ',mimeType:"application/json"}}}];' } });
workflow.connections['WhatsApp POST immediate 200'] = { main: [[{ node: 'Seed signed mock webhook', type: 'main', index: 0 }]] };
workflow.connections['Seed signed mock webhook'] = { main: [[{ node: 'Verify signature and extract messages', type: 'main', index: 0 }]] };
workflow.name = 'Mowakkid smoke test - fake services only';
workflow.id = 'MowakkidSmokeTest';
const file = join(folder, 'workflow.json');
await writeFile(file, JSON.stringify(workflow));
try {
  let output = '';
  const run = async args => {
    const child = spawn(cli, args, { env: { ...process.env, N8N_USER_FOLDER: folder, N8N_DIAGNOSTICS_ENABLED: 'false', N8N_VERSION_NOTIFICATIONS_ENABLED: 'false', N8N_TEMPLATES_ENABLED: 'false', N8N_BLOCK_ENV_ACCESS_IN_NODE: 'false', N8N_RUNNERS_ENABLED: 'true', N8N_RUNNERS_MODE: 'internal', NODE_FUNCTION_ALLOW_BUILTIN: 'crypto', META_APP_SECRET: secret, WHATSAPP_PHONE_NUMBER_ID: phoneId, N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    const timeout = setTimeout(() => child.kill('SIGTERM'), 120000);
    const status = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject); }); clearTimeout(timeout);
    await writeFile('/tmp/mowakkid-n8n-smoke.log', output);
    assert.equal(status, 0, 'n8n command failed; see /tmp/mowakkid-n8n-smoke.log');
  };
  await run(['import:workflow', '--input=' + file]);
  await run(['execute', '--id=' + workflow.id]);
  assert.equal(sheet.Orders[1][COLUMNS.Orders.indexOf('status')], 'confirmed');
  assert.equal(sheet.Orders[2][COLUMNS.Orders.indexOf('status')], 'cancelled');
  assert.equal(sheet.Orders[2][COLUMNS.Orders.indexOf('cancel_reason')], 'غيرت رأيي');
  assert.equal(sheet.Sessions.length, 2);
  assert.equal(sheet.Messages.length, 9); // header + eight unique incoming messages
  assert.equal(sheet.Messages.slice(1).every(r => r[COLUMNS.Messages.indexOf('delivery_status')] === 'sent'), true);
  assert.equal(sent.length, 8); assert.equal(aiCalls.length, 2);
  assert.equal(sheet.Errors.length, 2); // header + Gemini 429
  assert.equal(sent[2].interactive.action.buttons.length, 3);
  console.log('n8n runtime smoke passed: HMAC, all messages, loop pairing, Gemini success/429 fallback, atomic writes, confirm/location, cancel/reason, duplicate suppression.');
} finally { await new Promise(resolve => server.close(resolve)); await rm(folder, { recursive: true, force: true }); }
