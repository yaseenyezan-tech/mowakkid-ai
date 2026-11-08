# Mowakkid AI — موكّد

نظام تأكيد طلبات واتساب للبائع العراقي: استمارة للبائع، أزرار تأكيد/إلغاء/تعديل، حفظ الموقع، وحالة المحادثة في Google Sheets. يعمل على n8n المستضاف ذاتياً وWhatsApp Cloud API وGemini Flash، باستخدام عقد n8n الأساسية فقط.

Import the main workflow in n8n: **⋯ → Import from URL**:

```text
https://raw.githubusercontent.com/yaseenyezan-tech/mowakkid-ai/main/workflows/mowakkid.json
```

Import the separate error workflow too:

```text
https://raw.githubusercontent.com/yaseenyezan-tech/mowakkid-ai/main/workflows/mowakkid-errors.json
```

Raw URL pattern for another repository/branch:

```text
https://raw.githubusercontent.com/<OWNER>/<REPO>/<BRANCH>/workflows/mowakkid.json
```

Downloading either JSON and using **Import from File** also works. Both exports start inactive and contain no credential IDs or secret values. For a private fork, download while signed into GitHub, then import the file; an unauthenticated raw URL will not work.

- [الإعداد من الهاتف بالعربية](docs/SETUP_AR.md)
- [أسماء التبويبات والأعمدة حرفياً](docs/SHEET_COLUMNS.md)
- [قائمة الاختبار بالعربية](docs/TESTS_AR.md)

The seller shares the generated `wa.me` link with the customer. It opens a chat with the **business** number containing `تأكيد طلب <ORDER_ID>`. The customer sends that text to start the service window. The workflow sends no unsolicited messages or paid templates. Order details are disclosed only when the sender's normalized phone matches the order.

Run a **single n8n process** in regular mode with `N8N_CONCURRENCY_PRODUCTION_LIMIT=1`. Google Sheets provides no unique constraints or cross-execution locks; overlapping manual runs, multiple instances, or outside writers can break deduplication. Keep the form link private. Store credentials in n8n and configuration in server environment variables; see the setup guide for the complete list.

`Orders`, `Sessions`, and `Messages` are read for each event; state changes and the outgoing reply are committed in one Sheets `batchUpdate`. Each message is processed serially. Sent duplicates are skipped; prepared/failed duplicates reuse the saved reply. A crash between WhatsApp accepting a send and recording its result can still duplicate a reply. Immediate webhook acknowledgment also means Meta will not retry later Sheets failures automatically; follow the recovery instructions in the setup guide. This is a small-seller workflow, not a high-volume queue.

Gemini classifies edits/questions using a constrained JSON schema. A trusted bank of short Iraqi replies handles each intent; model-generated prose never determines a price, delivery promise, or order status. Customer edits are stored for seller review rather than automatically changing the product or price. The latest documented Flash model at implementation is set once in **Configuration - Flash model**, with an optional `GEMINI_MODEL` environment override. A failed/unavailable/free-quota-exhausted Gemini call falls back to fixed Iraqi text and the three buttons.

n8n Community Edition, Google Sheets API, and Gemini's available free tier require no paid subscription. Use an existing self-hosted server with HTTPS. Free quotas, regional availability, and Meta policies still apply; the workflow uses no chargeable WhatsApp template feature. See [Google model documentation](https://ai.google.dev/gemini-api/docs/models) and [pricing/free quotas](https://ai.google.dev/gemini-api/docs/pricing).

The error workflow must be selected manually in the main workflow's **Settings → Error Workflow** after import. It captures failed automatic executions; handled Gemini/WhatsApp failures write redacted rows directly. Sheets outages can also prevent the logger from writing, so inspect n8n's failed executions.

Development: Node.js 20+; no npm dependencies needed.

```sh
npm run check
```

This regenerates both JSON exports, parses/validates their graph, compiles every embedded Code node, and tests the conversation logic, signature verification, and durable outbox. Source: [src/domain.mjs](src/domain.mjs); workflow builder: [scripts/build-workflows.mjs](scripts/build-workflows.mjs). Local tests use simulated service responses; live Meta/Google/Gemini verification requires your credentials. Each node has a note about its `typeVersion`; older n8n installations may need an upgrade or field review.

Both exports were successfully imported using **n8n 2.46.6**. The incoming-message graph also passed a real n8n runtime test against local fake Sheets, Gemini, and WhatsApp endpoints, including a multi-message event, 429 fallback, confirmation/location, cancellation/reason, and duplicate suppression. To repeat with a separately installed n8n CLI and its supported Node.js version:

```sh
N8N_BIN=/path/to/n8n npm run test:n8n
```

The optional test uses an isolated temporary n8n database and no real credentials. It does not replace the phone checklist or verify live Meta configuration and Google authorization.
