# تشغيل موكّد AI من الهاتف

تحتاج متصفح هاتف، وحساب Meta للمحل، وحساب Google، ونسخة **n8n مستضافة ذاتياً ومحدّثة** لها رابط HTTPS ثابت. لا تحتاج n8n Cloud المدفوع. الهاتف يستخدم لوحة التحكم فقط؛ السيرفر يبقى شغّالاً حتى لو أغلقت الهاتف. إذا لم يكن عندك سيرفر جاهز، اطلب من المسؤول تجهيز n8n Community Edition ورابط HTTPS؛ ملفات هذا المستودع لا تنشئ استضافة تلقائياً.

فعّل «موقع سطح المكتب / Desktop site» في المتصفح عند صعوبة رؤية القوائم، واستخدم الوضع الأفقي. لا ترسل أي توكن أو مفتاح في محادثة أو مستودع GitHub.

## 1. جهّز Google Sheets

1. افتح [Google Sheets](https://sheets.google.com) وأنشئ ملفاً خاصاً بالطلبات.
2. أنشئ تبويبات `Orders` و`Sessions` و`Messages` و`Errors`، واحذف/أعد تسمية التبويب الافتراضي إذا احتجت.
3. ضع العناوين حرفياً وبالترتيب من [SHEET_COLUMNS.md](SHEET_COLUMNS.md). كل عنوان في خلية منفصلة من الصف الأول. لا تضف بيانات تجريبية الآن.
4. من رابط الملف انسخ الجزء بين `/d/` و`/edit`. هذا هو `GOOGLE_SHEET_ID`. احتفظ به في إعدادات السيرفر، وليس في ملف سير العمل.
5. لا تجعل الملف عاماً؛ أرقام ومواقع الزبائن خاصة.

## 2. جهّز تطبيق Meta وواتساب

1. افتح [Meta for Developers](https://developers.facebook.com/apps/) وسجّل الدخول. أنشئ تطبيقاً مناسباً للأعمال وأضف منتج/use case **WhatsApp**. أسماء القوائم قد تتغير عند Meta.
2. افتح **WhatsApp → API Setup**. جرّب برقم Meta التجريبي أولاً، وأضف رقم هاتفك كمستلم اختبار وكمّله برمز التحقق. التشغيل التجريبي يرسل فقط للأرقام المسموحة.
3. انسخ **Phone number ID** إلى متغير `WHATSAPP_PHONE_NUMBER_ID`. هذا معرّف تقني، وليس رقم الهاتف الذي يبدأ بـ`964`.
4. رقم واتساب الفعلي الظاهر للزبون، بصيغة دولية وبدون `+`، يوضع في `WHATSAPP_BUSINESS_PHONE`. الرقم التجريبي قد يكون دولياً من بلد آخر؛ انسخه كما هو. هذا الرقم هو وجهة رابط `wa.me`.
5. من **App settings → Basic** افتح **App Secret** وانسخه سراً إلى `META_APP_SECRET`.
6. لبدء التجربة تستطيع استخدام Access Token المؤقت. للتشغيل المستمر أنشئ System User في إعدادات أعمال Meta، وامنحه التطبيق وحساب WhatsApp وصلاحيات `whatsapp_business_messaging` و`whatsapp_business_management` المناسبة. أنشئ توكن طويل العمر/غير منتهٍ إن كان حسابك يسمح، واحتفظ به في credential داخل n8n. التوكن المؤقت ينتهي وقد يسبب توقف الإرسال.
7. انسخ إصدار Graph API الذي يعرضه Meta إلى `META_GRAPH_VERSION`، بالشكل `vNN.N` مع الأرقام الفعلية. لا تضع URL كاملاً ولا كلمة placeholder.
8. قبل استخدام رقم المحل الحقيقي أكمل إضافة الرقم والتحقق منه وأي متطلبات اسم النشاط/Business Verification/Live Mode التي يعرضها حسابك. استخدام رقم WhatsApp قائم يعتمد على أهلية Coexistence أو نقل الرقم وفق تعليمات Meta؛ لا تحذف حساب واتساب الحالي عشوائياً.

## 3. إعدادات السيرفر مرة واحدة

من الهاتف افتح لوحة الاستضافة → Environment variables / متغيرات البيئة. إذا يدير السيرفر شخص آخر، أعطه **أسماء** المتغيرات التالية ليضيفها، وأدخل الأسرار في لوحة الاستضافة الآمنة. بعد أي تغيير أعد تشغيل n8n.

| المتغير | ماذا تضع؟ |
|---|---|
| `GOOGLE_SHEET_ID` | `{{GOOGLE_SHEET_ID}}` من رابط ملف Sheets |
| `WHATSAPP_PHONE_NUMBER_ID` | `{{WHATSAPP_PHONE_NUMBER_ID}}` من Meta |
| `WHATSAPP_BUSINESS_PHONE` | `{{WHATSAPP_BUSINESS_PHONE}}`، رقم واتساب التجاري الدولي بدون `+` |
| `META_GRAPH_VERSION` | إصدار Graph الفعلي من Meta، بالشكل `vNN.N` |
| `META_APP_SECRET` | سر تطبيق Meta، سري |
| `META_VERIFY_TOKEN` | كلمة عشوائية طويلة تنشئها أنت بمدير كلمات مرور؛ لا تستخدم App Secret أو Access Token مكانها |
| `WEBHOOK_URL` | رابط n8n العام الثابت، مثلاً `https://{{N8N_PUBLIC_HOST}}/` |
| `N8N_EDITOR_BASE_URL` | نفس رابط لوحة n8n العام |
| `EXECUTIONS_MODE` | `regular` |
| `N8N_CONCURRENCY_PRODUCTION_LIMIT` | `1`، مطلوب لحماية حالة Sheets والتكرار |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false`، للسماح للتعبيرات وCode بقراءة متغيرات البيئة |
| `NODE_FUNCTION_ALLOW_BUILTIN` | `crypto` فقط؛ لفحص توقيع Meta وتوليد معرّف عشوائي |
| `N8N_RUNNERS_ENABLED` | `true` |
| `N8N_RUNNERS_MODE` | `internal` في هذا الإعداد البسيط ذي العملية الواحدة |
| `N8N_ENCRYPTION_KEY` | مفتاح عشوائي ثابت وآمن يضبطه مسؤول السيرفر؛ لا تغيّره بعد حفظ credentials |
| `GEMINI_MODEL` | اختياري؛ اتركه غير مضبوط لاستخدام Flash الافتراضي في عقدة Configuration |

`{{...}}` شرح لمكان القيمة فقط؛ استبدله بالقيمة الحقيقية في لوحة البيئة. لا تلصق هذه العلامات حرفياً. لا تشغّل عدة نسخ n8n ولا queue workers ولا تضغط Execute يدوياً أثناء وصول الرسائل. حد الإنتاج لا يمنع تشغيلتين يدويتين معاً. إذا استعمل المسؤول external task runners بدلاً من internal، عليه تمرير صلاحية `crypto` وإعدادات الوصول للبيئة إلى runner حسب إصدار n8n؛ افحص عقدتي التوقيع ومعرّف الطلب قبل التفعيل.

السير يرد على POST فوراً، ثم يتحقق من توقيع Meta ويعالج البيانات. لا تستخدم عنوان `/webhook-test/` مع Meta. احمِ لوحة n8n بحساب قوي، ولا تعطِ صلاحية تعديل Code إلا للمسؤول الموثوق لأن هذه العقد تستطيع الوصول لمتغيرات البيئة. أبقِ حفظ الأخطاء ومدة الاحتفاظ بها محصورين ومناسبين للخصوصية.

## 4. اربط حساب Google في n8n

1. في [Google Cloud Console](https://console.cloud.google.com) أنشئ مشروعاً مجانياً. فعّل **Google Sheets API** و**Google Drive API** من APIs & Services → Library.
2. جهّز OAuth consent screen / Google Auth Platform. اختر External إذا كان حسابك شخصياً، وأضف بريدك إلى Test users أثناء التجربة. لا تحتاج اشتراكاً مدفوعاً.
3. افتح n8n → Credentials → New → **Google Sheets OAuth2 API**. سمّه `Mowakkid Google Sheets`، وانسخ **OAuth Redirect URL** الذي يظهر.
4. ارجع Google Cloud → Credentials → Create OAuth client ID → Web application. ضع رابط التحويل المنسوخ في **Authorized redirect URIs** تماماً، بما فيه HTTPS والمسار.
5. انسخ Client ID وClient Secret إلى credential داخل n8n، ثم **Sign in with Google** ووافق على صلاحيات Sheets/Drive. اختَر الحساب الذي يملك ملف الطلبات. لا تضف الأسرار إلى Google Sheet.
6. إذا التطبيق في Testing فقد تحتاج إعادة ربط OAuth بعد انتهاء توكن الاختبار، غالباً خلال 7 أيام. للتشغيل الطويل اتبع متطلبات Google لنشر consent app أو استخدم إعداد المؤسسة الداخلي إن توفر. تنبيه «التطبيق غير موثّق» في تطبيقك التجريبي لا يعني الدفع؛ راجع أنك أنت صاحب المشروع قبل المتابعة.

معظم عقد Sheets هنا هي **HTTP Request** باستخدام predefined credential type `Google Sheets OAuth2 API` للوصول إلى Sheets API وتنفيذ تغييرات الطلب والجلسة والرد في دفعة واحدة. توجد عقدة Google Sheets العادية في سير الأخطاء. جميعها تستخدم نفس credential.

## 5. أنشئ credentials لواتساب وGemini

في n8n → Credentials → New → **Header Auth**:

| الاسم داخل n8n | Name للـheader | Value |
|---|---|---|
| `Mowakkid WhatsApp` | `Authorization` | `Bearer {{WHATSAPP_ACCESS_TOKEN}}`، مع استبدال placeholder بالتوكن الفعلي وترك مسافة بعد Bearer |
| `Mowakkid Gemini` | `x-goog-api-key` | `{{GEMINI_API_KEY}}`، المفتاح الفعلي فقط |

احصل على مفتاح Gemini من [Google AI Studio](https://aistudio.google.com/apikey). استخدم free tier المتاح لحسابك ومنطقتك؛ لا يلزم تفعيل billing لهذا السير. اسم Flash الافتراضي موجود مرة واحدة في **Configuration - Flash model**، ويمكن تغييره عبر `GEMINI_MODEL`. راجع [قائمة النماذج](https://ai.google.dev/gemini-api/docs/models) و[التسعير والحصة المجانية](https://ai.google.dev/gemini-api/docs/pricing) عند الإعداد لأن التوفر يتغير. إذا رفضت الخدمة المفتاح أو نفدت الحصة، يبقى تأكيد الطلب وإلغاؤه شغّالين، وتستخدم أسئلة التعديل رداً ثابتاً مع الأزرار.

لا يرسل السير إلى Gemini رقم الهاتف أو الموقع أو اسم الزبون. يرسل نص السؤال ووصف المنتج وسعره فقط. تجنّب كتابة أسرار في نصوص الأسئلة.

## 6. استورد الملفين من GitHub

1. في n8n أنشئ Workflow جديداً، ثم قائمة **⋯ → Import from URL** والصق:

```text
https://raw.githubusercontent.com/yaseenyezan-tech/mowakkid-ai/main/workflows/mowakkid.json
```

2. احفظه. افتح كل عقدة تطلب credential وحدد الاسم المناسب من الخطوتين السابقتين. كل عقد `Read…` و`Commit…` و`Persist…` تستخدم Google؛ `Send WhatsApp reply` تستخدم WhatsApp؛ `Gemini classify safely` تستخدم Gemini.
3. أنشئ Workflow ثانياً واستورد:

```text
https://raw.githubusercontent.com/yaseenyezan-tech/mowakkid-ai/main/workflows/mowakkid-errors.json
```

4. في `Append error to Errors sheet` اختَر `Mowakkid Google Sheets` واحفظ. ارجع للسير الأساسي → Settings → **Error Workflow** → اختَر **Mowakkid AI - Error logger** → احفظ. لا تختَر سير الأخطاء كمعالج أخطاء لنفسه. Error Trigger لا يحتاج رابطاً عاماً أو تفعيله كـwebhook؛ يكفي حفظه وربطه بالسير الأساسي.
5. لا تغيّر JSON يدوياً لحفظ credentials أو معرّفات. العقد تستخدم متغيرات البيئة. كل عقدة فيها Note بخصوص `typeVersion`. إذا ظهرت Unknown node أو Missing version، حدّث n8n، أو أعد إنشاء العقدة الأساسية بنفس الخيارات على نسختك ثم أعد الاختبارات. انتبه خصوصاً إلى Form Trigger، Form completion، HTTP Request، IF، Google Sheets.
6. إذا لم يظهر Import from URL على الهاتف، افتح رابط raw في المتصفح واختر تنزيل، ثم **Import from File** وحدد ملف JSON من «التنزيلات». الملفات صالحة للاستيراد كل واحد على حدة، وليست ZIP أو قائمة workflows.

## 7. فعّل السير واربط Webhook في Meta

1. في السير الأساسي اضغط **Activate / Active** أو **Publish** حسب إصدار n8n. افحص أن لا توجد عقد تطلب credential ناقصاً.
2. افتح عقدة `Meta verify GET` وانسخ **Production URL**. العقدة POST لها نفس المسار وHTTP method مختلف. الشكل المعتاد:

```text
https://{{N8N_PUBLIC_HOST}}/webhook/mowakkid-whatsapp
```

3. في Meta → WhatsApp → Configuration → Webhooks → Edit: ضع هذا الرابط في Callback URL، والقيمة نفسها من `META_VERIFY_TOKEN` في Verify Token. اضغط **Verify and Save**. يرجع السير `hub.challenge` كنص عند صحة التوكن، و403 عند الخطأ.
4. اشترك بحقل **messages**. عند إدارة الحساب عبر System User/API تأكد أيضاً أن التطبيق مشترك في WABA عبر subscribed_apps؛ اتبع خيار الاشتراك الذي يعرضه Meta. بدون هذا الاشتراك لن تصل الرسائل حتى لو نجح Verify.
5. أبقِ **Respond Immediately** و**Raw Body** مفعّلين في `WhatsApp POST immediate 200`. توقيع `X-Hub-Signature-256` يُفحص باستخدام App Secret. status callbacks لا تُشغّل محادثة ولا يُرد عليها. الطلب ذو التوقيع الخاطئ يأخذ إقرار 200 الفوري ثم يُرفض داخلياً ويُسجل الخطأ.
6. افتح عقدة `Seller order form` وانسخ **Production Form URL**؛ عادةً ينتهي بـ`/form/mowakkid-seller`. احتفظ بالرابط للبائع فقط. النموذج العام بلا تسجيل دخول؛ من يعرف الرابط يستطيع إضافة طلب. إذا احتجت مشاركته بين موظفين، اطلب من مسؤولك حمايته بمصادقة النموذج/البوابة المناسبة لإصدار n8n.

## 8. تجربة من الهاتف

1. افتح استمارة البائع وأدخل اسم الزبون والمنتج والسعر ورقم هاتف الاختبار المسموح في Meta. اكتب السعر بدون كسور. يقبل البرنامج الأرقام العربية والفارسية والإنجليزية، ويقبل الفاصلة في الآلاف.
2. اضغط الحفظ وانتظر ظهور رقم الطلب والرابط. لا يظهر النجاح إلا بعد حفظ الطلب في `Orders` بحالة `pending`.
3. **انسخ رابط `wa.me` وأرسله للزبون**. وجهته رقم واتساب التجاري؛ ليس رابط محادثة مع رقم الزبون. في اختبارك افتحه من حساب الزبون/رقم الاختبار، ثم اضغط إرسال للنص المعبأ `تأكيد طلب MW-…`. فتح الرابط وحده لا يرسل رسالة.
4. يجب أن تصلك تفاصيل الطلب والأزرار باللهجة العراقية. جرّب التأكيد ثم مشاركة موقع الاستلام. افحص أن `Orders` صار `confirmed` وأن الإحداثيات ورابط الخريطة محفوظة.
5. أكمل [TESTS_AR.md](TESTS_AR.md) قبل استعمال أرقام حقيقية.

النافذة تُحسب من وقت رسالة الزبون + 24 ساعة؛ لا توجد رسائل استباقية أو templates مدفوعة. بعد الانتهاء ينتظر النظام رسالة جديدة من الزبون. أزرار قديمة لا تعيد فتح طلب `confirmed` أو `cancelled`. ملاحظة تعديل مثل «أني بأربيل مو ببغداد» تُحفظ للبائع في `edit_request`، ولا تعني ضمان التوصيل أو تعديل السعر تلقائياً.

## 9. إذا توقف الرد أو احتجت استرجاع رسالة

افتح n8n → **Executions**. Error Trigger يعمل عند فشل تنفيذ تلقائي، وليس عند Execute يدوياً. أخطاء Gemini وWhatsApp المعالجة تُكتب مباشرة في `Errors`. إذا Google نفسها غير متاحة فلن يستطيع سير الأخطاء الكتابة إليها؛ شاشة Executions هي المرجع عندها.

- **Verify فشل:** افحص HTTPS وProduction URL والتفعيل وتطابق Verify Token. ظهور 404 غالباً يعني مساراً غير مفعّل أو `/webhook-test/`.
- **لا تصل رسائل:** راجع اشتراك messages وWABA، رقم Phone Number ID، حساب WhatsApp التجريبي والمستلمين المسموحين.
- **INVALID_META_SIGNATURE:** افحص App Secret وRaw Body، وتأكد أن الـreverse proxy لا يغير جسم JSON. لا توقف فحص التوقيع لحل المشكلة.
- **لا تظهر تفاصيل الطلب:** يجب أن رقم المرسل يطابق `customer_phone`. المعرّف وحده لا يعطي حق قراءة طلب غيره.
- **Header/schema error:** راجع أسماء التبويبات والعناوين وترتيبها حسب ملف الأعمدة.
- **WhatsApp failed:** راجع رمز الخطأ في `Errors`، وصلاحيات/انتهاء التوكن، وإعداد الرقم. الرد المحفوظ في `Messages.reply_json` يبقى مع الحالة `failed`.
- **Gemini فشل/429:** الرد الثابت مع الأزرار هو السلوك المتوقع. صحّح المفتاح/النموذج أو انتظر تجدد الحصة؛ لا يلزم ترقية مدفوعة.

**استرجاع بعد العطل:** لأن POST يأخذ 200 فوراً، لا تعتمد على أن Meta تعيد الإرسال بعد عطل Sheets. أوقف استقبال/تفعيل السير مؤقتاً، أصلح السبب، وأوقف أي اختبارات يدوية موازية. إذا يوجد تنفيذ فاشل قبل إتمام العمل، يستطيع المسؤول استخدام Retry من بيانات التنفيذ المحفوظة بعد فحص `Messages`؛ إعادة المرور من التوقيع/قراءة الحالة آمنة من ناحية تغيير الطلب عند تكرار `message_id`. لا تعِد تشغيل عقدة Send منفردة إذا كانت الحالة `sent`.

إذا كانت الحالة `prepared` أو `failed`، إعادة **نفس الحدث الأصلي بنفس message_id** خلال النافذة تعيد استخدام الرد المحفوظ، دون إعادة انتقال الحالة. لا تُنشئ معرّفاً جديداً يدوياً. مسؤول تقني يستطيع إعادة الحدث المحفوظ إلى بداية المعالجة/نقطة التوقيع مع جسمه الأصلي؛ لا تنشر حمولة الحدث أو App Secret. عند عدم توفر الحدث، اطلب من الزبون إعادة إرسال رابط التأكيد/رقم الطلب، ثم افحص حالة الطلب؛ لا تصفّر الحالات أو تحذف سجل Messages لحل العطل. بعد 24 ساعة لا تعِد إرسال outbox القديم؛ اطلب رسالة جديدة من الزبون.

يوجد حد واقعي: إذا قبل Meta الرد وانقطع n8n قبل كتابة `sent`، قد تصل إجابة مكررة عند الاسترجاع؛ لا يتيح هذا الإعداد ضمان الإرسال مرة واحدة بالضبط. لا يوجد مؤقّت إعادة إرسال آلي، وHTTP send لا يعيد المحاولة تلقائياً. قبل التعديل اليدوي على الصفوف أو ترتيبها أوقف السير، وبعده أعد تفعيله. احتفظ بنسخة احتياطية خاصة للملف وcredentials، وبمفتاح تشفير n8n الثابت.
