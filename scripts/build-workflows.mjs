import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const domain = (await readFile(new URL('../src/domain.mjs', import.meta.url), 'utf8')).replace(/^export /gm, '');
const nodes = [], connections = {};
function node(name, type, version, position, parameters, extra = {}) {
  const id = createHash('sha256').update(name).digest('hex').slice(0, 32);
  nodes.push({ parameters, id, name, type: 'n8n-nodes-base.' + type, typeVersion: version, position,
    notes: `Built with ${type} v${version}. If your n8n offers a different typeVersion, update this node in the editor and recheck its fields.`, ...extra });
  return name;
}
const code = (name, pos, source, bundled = true) => node(name, 'code', 2, pos, { mode: 'runOnceForAllItems', jsCode: (bundled ? domain + '\n' : '') + source });
function link(from, to, output = 0) {
  connections[from] ??= { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}
const google = { googleSheetsOAuth2Api: { id: null, name: 'Mowakkid Google Sheets' } };
const base = "https://sheets.googleapis.com/v4/spreadsheets/";
const sheetUrl = tail => `={{ '${base}' + encodeURIComponent($env.GOOGLE_SHEET_ID) + '${tail}' }}`;
const jsonOptions = { timeout: 20000, response: { response: { responseFormat: 'json' } } };
function sheets(name, pos, method, tail, jsonBody) {
  return node(name, 'httpRequest', 4.2, pos, { method, url: sheetUrl(tail), authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', ...(jsonBody ? { sendBody: true, specifyBody: 'json', jsonBody } : {}), options: jsonOptions }, { credentials: google });
}
function iff(name, pos, expression) {
  return node(name, 'if', 2.2, pos, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: name, leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} });
}
function note(name, pos, content, width, height, color) { node(name, 'stickyNote', 1, pos, { content, width, height, color }); }

note('01 Seller flow', [-940, -640], '## 1 · Seller form → saved order → customer link\nSend the resulting wa.me link to the customer. The link opens a chat with your BUSINESS number; the customer must send the prefilled text. No business-initiated/template message is sent.', 1080, 340, 4);
node('Seller order form', 'formTrigger', 2.2, [-880, -510], { path: 'mowakkid-seller', formTitle: 'موكّد AI — طلب جديد', formDescription: 'أدخل بيانات الطلب. بعد الحفظ انسخ رابط التأكيد وأرسله للزبون.', formFields: { values: ['اسم الزبون', 'المنتج', 'السعر بالدينار العراقي', 'رقم هاتف الزبون'].map(fieldLabel => ({ fieldLabel, fieldType: 'text', requiredField: true })) }, responseMode: 'lastNode', options: { buttonLabel: 'حفظ الطلب وإظهار الرابط', appendAttribution: false } }, { webhookId: 'mowakkid-seller-form' });
code('Validate seller and create order ID', [-620, -510], `const crypto = require('crypto');\nconst job = sellerJob($input.first().json, crypto.randomBytes(8).toString('hex').toUpperCase(), $env.WHATSAPP_BUSINESS_PHONE);\nreturn [{ json: job }];`);
link('Seller order form', 'Validate seller and create order ID');

note('02 Meta verification', [-940, -250], '## 2 · Meta GET verification\nSame path as POST, different HTTP method. Valid verify token → plain hub.challenge. Invalid token → 403. Use production URL.', 1080, 310, 5);
node('Meta verify GET', 'webhook', 2, [-880, -110], { httpMethod: 'GET', path: 'mowakkid-whatsapp', responseMode: 'responseNode', options: {} }, { webhookId: 'mowakkid-meta-get' });
code('Verify Meta challenge token', [-620, -110], `const q = $input.first().json.query ?? {};\nconst challenge = q['hub.challenge'];\nconst valid = Boolean($env.META_VERIFY_TOKEN) && q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === $env.META_VERIFY_TOKEN && typeof challenge === 'string' && challenge.length > 0 && challenge.length <= 1024;\nreturn [{ json: { status: valid ? 200 : 403, body: valid ? challenge : 'Forbidden' } }];`, false);
node('Return challenge or 403', 'respondToWebhook', 1.4, [-360, -110], { respondWith: 'text', responseBody: '={{ $json.body }}', options: { responseCode: '={{ $json.status }}', responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/plain; charset=utf-8' }] } } });
link('Meta verify GET', 'Verify Meta challenge token'); link('Verify Meta challenge token', 'Return challenge or 403');

note('03 Incoming WhatsApp', [-940, 100], '## 3 · POST → immediate 200 → HMAC → messages only\nRaw body is required for X-Hub-Signature-256. Status callbacks produce no jobs. All entries/messages are processed in timestamp order, one at a time. Invalid signatures are discarded after acknowledgment and logged as errors.', 1080, 360, 5);
node('WhatsApp POST immediate 200', 'webhook', 2, [-880, 260], { httpMethod: 'POST', path: 'mowakkid-whatsapp', responseMode: 'onReceived', options: { rawBody: true } }, { webhookId: 'mowakkid-meta-post', notes: 'Webhook v2: keep Raw Body ON and Respond Immediately. Both GET/POST share mowakkid-whatsapp. Meta receives 200 before processing; Sheets failures require operator recovery (see SETUP_AR).' });
code('Verify signature and extract messages', [-600, 260], `const crypto = require('crypto');\nif (!$env.META_APP_SECRET || !$env.WHATSAPP_PHONE_NUMBER_ID) throw new Error('META_ENV_MISSING');\nconst item = $input.first();\nconst raw = await this.helpers.getBinaryDataBuffer(0, 'data');\nconst sig = String(item.json.headers?.['x-hub-signature-256'] ?? '');\nif (!/^sha256=[a-f0-9]{64}$/.test(sig)) throw new Error('INVALID_META_SIGNATURE');\nconst expected = crypto.createHmac('sha256', $env.META_APP_SECRET).update(raw).digest();\nif (!crypto.timingSafeEqual(expected, Buffer.from(sig.slice(7), 'hex'))) throw new Error('INVALID_META_SIGNATURE');\nreturn extractMessages(JSON.parse(raw.toString('utf8')), $env.WHATSAPP_PHONE_NUMBER_ID).map(job => ({ json: job }));`);
link('WhatsApp POST immediate 200', 'Verify signature and extract messages');

note('04 Shared state engine', [160, -640], '## 4 · Serial state engine — Google Sheets OAuth2\nRequired: ONE n8n process, N8N_CONCURRENCY_PRODUCTION_LIMIT=1. No overlapping manual executions or other sheet writers.\nRead Orders/Sessions/Messages → authorize customer phone → plan changes → optional Gemini → atomic Sheets batchUpdate.\nModel lives ONLY in the configuration node. Sheet IDs are resolved from tab metadata. No paid nodes or LLM framework.', 1660, 1180, 6);
node('Configuration - Flash model', 'set', 3.4, [220, -430], { mode: 'manual', assignments: { assignments: [{ id: 'gemini-model', name: 'gemini_model', value: "={{ $env.GEMINI_MODEL || 'gemini-3.8-flash' }}", type: 'string' }] }, includeOtherFields: true, options: {} });
node('Each message or order', 'splitInBatches', 3, [460, -430], { batchSize: 1, options: {} });
sheets('Read tab metadata', [700, -430], 'GET', '?fields=sheets.properties');
sheets('Read state tables', [940, -430], 'GET', '/values:batchGet?ranges=Orders&ranges=Sessions&ranges=Messages&valueRenderOption=UNFORMATTED_VALUE');
code('Plan authorized state transition', [1190, -430], `const job = $('Each message or order').item.json;\nconst db = snapshot($('Read tab metadata').item.json, $input.first().json);\nreturn [{ json: plan(job, db) }];`);
iff('Already processed?', [1440, -430], '={{ $json.skip }}');
iff('Needs Gemini?', [1440, -170], '={{ $json.ai }}');
node('Gemini classify safely', 'httpRequest', 4.2, [1190, 50], { method: 'POST', url: "={{ 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent($json.job.gemini_model) + ':generateContent' }}", authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.geminiBody }}', options: { timeout: 15000, response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } } } }, { credentials: { httpHeaderAuth: { id: null, name: 'Mowakkid Gemini' } }, onError: 'continueRegularOutput', notes: 'HTTP Request v4.2: keep Include Response Headers and Status and Never Error ON; On Error → Continue (regular output). 429, timeout, blocked/invalid output all use fixed Iraqi reply with buttons.' });
code('Use safe AI intent or fixed fallback', [940, 50], `const p = $('Plan authorized state transition').item.json;\nreturn [{ json: commitPlan(p, $input.first().json) }];`);
code('Prepare deterministic commit', [1190, 290], `return [{ json: commitPlan($input.first().json) }];`);
sheets('Commit state and outbox atomically', [700, 290], 'POST', ':batchUpdate', '={{ $json.writeBody }}');
code('Restore committed context', [460, 290], `const p = $('Plan authorized state transition').item.json;\n// This plan object was serialized before AI; use the matching commit branch output.\nconst committed = p.ai ? $('Use safe AI intent or fixed fallback').item.json : $('Prepare deterministic commit').item.json;\nreturn [{ json: committed }];`, false);
iff('Seller result?', [220, 290], "={{ $json.job.kind === 'seller' }}");

link('Validate seller and create order ID', 'Configuration - Flash model');
link('Verify signature and extract messages', 'Configuration - Flash model');
link('Configuration - Flash model', 'Each message or order'); link('Each message or order', 'Read tab metadata', 1);
link('Read tab metadata', 'Read state tables'); link('Read state tables', 'Plan authorized state transition'); link('Plan authorized state transition', 'Already processed?');
link('Already processed?', 'Each message or order', 0); link('Already processed?', 'Needs Gemini?', 1);
link('Needs Gemini?', 'Gemini classify safely', 0); link('Gemini classify safely', 'Use safe AI intent or fixed fallback'); link('Use safe AI intent or fixed fallback', 'Commit state and outbox atomically');
link('Needs Gemini?', 'Prepare deterministic commit', 1); link('Prepare deterministic commit', 'Commit state and outbox atomically');
link('Commit state and outbox atomically', 'Restore committed context'); link('Restore committed context', 'Seller result?');

note('05 Seller completion', [-940, 540], '## 5 · Saved successfully → show link\nOnly displayed after the sheet write succeeds. Copy/share the link with the customer; sending the prefilled message opens the 24-hour service window.', 1080, 290, 4);
node('Show seller customer link', 'form', 1, [-560, 670], { operation: 'completion', respondWith: 'showText', responseText: '={{ "<h2>انحفظ الطلب ✅</h2><p>رقم الطلب: " + $json.job.order.order_id + "</p><p>انسخ الرابط وأرسله للزبون. الزبون يفتحه ويضغط إرسال داخل واتساب:</p><p><a target=\"_blank\" rel=\"noopener noreferrer\" href=\"" + $json.job.wa_link + "\">" + $json.job.wa_link + "</a></p>" }}', options: {} }, { webhookId: 'mowakkid-form-complete' });
link('Seller result?', 'Show seller customer link', 0);

note('06 Durable replies', [1900, -640], '## 6 · Send only inside customer service window\nReply is committed before sending. Duplicate message ID + sent → skip; prepared/failed → reuse persisted reply without repeating state changes.\nWhatsApp has no exactly-once guarantee: a crash after a successful send but before marking sent can duplicate the reply. Never automatically retry sending HTTP requests. Errors store codes only, without tokens or payloads.', 1340, 1160, 3);
iff('Has reply?', [1980, -430], '={{ Boolean($json.reply) }}');
iff('Window still open?', [2220, -430], '={{ Date.now() < Date.parse($json.message.window_expires_at) }}');
node('Send WhatsApp reply', 'httpRequest', 4.2, [2460, -430], { method: 'POST', url: "={{ 'https://graph.facebook.com/' + $env.META_GRAPH_VERSION + '/' + encodeURIComponent($env.WHATSAPP_PHONE_NUMBER_ID) + '/messages' }}", authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.reply }}', options: { timeout: 15000, response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } } } }, { credentials: { httpHeaderAuth: { id: null, name: 'Mowakkid WhatsApp' } }, onError: 'continueRegularOutput', retryOnFail: false });
code('Record WhatsApp delivery result', [2700, -430], `const p = $('Restore committed context').item.json;\nreturn [{ json: { deliveryWrite: deliveryResult(p, $input.first().json, $execution.id) } }];`);
code('Mark expired before send', [2460, -170], `const p = $('Restore committed context').item.json;\nreturn [{ json: { deliveryWrite: deliveryResult(p, { localExpired: true }, $execution.id) } }];`);
sheets('Persist delivery status and errors', [2940, -170], 'POST', ':batchUpdate', '={{ $json.deliveryWrite }}');
link('Seller result?', 'Has reply?', 1); link('Has reply?', 'Window still open?', 0); link('Has reply?', 'Each message or order', 1);
link('Window still open?', 'Send WhatsApp reply', 0); link('Window still open?', 'Mark expired before send', 1);
link('Send WhatsApp reply', 'Record WhatsApp delivery result'); link('Record WhatsApp delivery result', 'Persist delivery status and errors'); link('Mark expired before send', 'Persist delivery status and errors'); link('Persist delivery status and errors', 'Each message or order');

const workflow = { name: 'Mowakkid AI - Iraqi WhatsApp order confirmation', nodes, pinData: {}, connections, active: false, settings: { executionOrder: 'v1', timezone: 'Asia/Baghdad', saveDataErrorExecution: 'all', saveDataSuccessExecution: 'none', saveManualExecutions: true, executionTimeout: 300 }, tags: [] };

// Separate error workflow: import it and select it in main workflow Settings → Error Workflow.
const errorNodes = [];
function errorNode(name, type, version, position, parameters, extra = {}) {
  errorNodes.push({ name, id: createHash('sha256').update(name).digest('hex').slice(0,32), type: 'n8n-nodes-base.' + type, typeVersion: version, position, parameters, notes: `Node version ${version}; check fields if n8n offers an upgrade.`, ...extra });
}
errorNode('Automatic execution error', 'errorTrigger', 1, [0, 180], {});
errorNode('Build redacted error row', 'code', 2, [260, 180], { mode: 'runOnceForAllItems', jsCode: `const e = $input.first().json;\nreturn [{ json: { timestamp: new Date().toISOString(), workflow: String(e.workflow?.name ?? 'Mowakkid AI').slice(0,160), execution_id: String(e.execution?.id ?? ''), node: String(e.execution?.lastNodeExecuted ?? e.trigger?.error?.node?.name ?? 'activation'), error_code: String(e.execution?.error?.name ?? e.trigger?.error?.name ?? 'ExecutionError').slice(0,80), message_id: '', message: 'Execution failed. Open the execution in n8n to investigate; raw errors/payloads are intentionally not copied.' } }];` });
errorNode('Append error to Errors sheet', 'googleSheets', 4.6, [520, 180], { operation: 'append', documentId: { __rl: true, value: '={{ $env.GOOGLE_SHEET_ID }}', mode: 'id' }, sheetName: { __rl: true, value: 'Errors', mode: 'name' }, columns: { mappingMode: 'defineBelow', value: Object.fromEntries(['timestamp', 'workflow', 'execution_id', 'node', 'error_code', 'message_id', 'message'].map(c => [c, '={{ $json.' + c + ' }}'])), matchingColumns: [], schema: ['timestamp', 'workflow', 'execution_id', 'node', 'error_code', 'message_id', 'message'].map(id => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true })), attemptToConvertTypes: false, convertFieldsToString: false }, options: { cellFormat: 'RAW', useAppend: true } }, { credentials: google });
errorNode('Error logger instructions', 'stickyNote', 1, [-30, -110], { content: '## Import this separately\nSelect this workflow under the MAIN workflow Settings → Error Workflow after saving both. Error Trigger handles failed automatic executions; manual tests do not invoke it.\nAuthorize Google Sheets. If Sheets itself is unavailable, inspect n8n executions: this logger cannot write to an unavailable service. Do not set this logger as its own error workflow.', width: 820, height: 240, color: 3 });
const errorWorkflow = { name: 'Mowakkid AI - Error logger', nodes: errorNodes, pinData: {}, connections: { 'Automatic execution error': { main: [[{ node: 'Build redacted error row', type: 'main', index: 0 }]] }, 'Build redacted error row': { main: [[{ node: 'Append error to Errors sheet', type: 'main', index: 0 }]] } }, active: false, settings: { executionOrder: 'v1', timezone: 'Asia/Baghdad', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all' }, tags: [] };
await mkdir(new URL('../workflows/', import.meta.url), { recursive: true });
for (const [filename, data] of [['mowakkid.json', workflow], ['mowakkid-errors.json', errorWorkflow]]) await writeFile(new URL('../workflows/' + filename, import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(`Built ${nodes.length} main nodes and ${errorNodes.length} error logger nodes.`);
