# تسليم المشروع لجلسة جديدة (Claude Code)

## مين صاحب المشروع وكيف تحكي معه
- صاحب المشروع مش مبرمج. احكِ معه **بعربي أردني بسيط وقصير**، خطوة وحدة كل مرة، وقول له بالضبط شو يضغط (ممكن تعلّم صورة بدوائر حمراء).
- كن صادقاً: إذا شي ما جربته أو ما بتقدر تعمله، قول ذلك. ما تحكي "أقوى شي بالعالم".
- **ما تطلب منه ولا تكرر أي كلمة سر أو مفتاح سرّي.** هو بحط المفاتيح بنفسه بكلاودفلير. إذا ظهر مفتاح بصورة أو رسالة، اعتبره مكشوف وأضف hash إلى `parkqr/site/functions/api/_security.js` (EXPOSED list) بدون النص.

## المشروع
"يا نشمي" (yanashmi.com): ستيكر QR على زجاج السيارة. اللي مسكّر على حدا بيمسحه (صفحة ويب بدون تحميل)، بيختار رسالة جاهزة (أو ملاحظة/صورة من الكاميرا المباشرة/محادثة قصيرة)، وصاحب السيارة بيستقبلها (موقع أو تطبيق أندرويد). الأرقام مخفية عن الطرفين.

## الكود (repo: abdulrahmanalhamoud1673/giraffe-meme، الفرع: claude/gallant-cerf-ggjn2q)
- `parkqr/site/` موقع Cloudflare Pages (الجذر)، كل push بينشر تلقائياً. `functions/api/*` = Pages Functions، قاعدة D1 (binding `DB`).
- `parkqr/tests/` فحوصات: `npm test` (وحدات) + e2e Playwright (`NODE_PATH=$(npm root -g) node e2e/<name>.cjs` مع `node --no-warnings dev-server.mjs` على 8788).
- `parkqr/android/` تطبيق أندرويد أصلي (Kotlin + Compose). البناء: `./gradlew :app:assembleDebug` (Android SDK 35 + Java 17+). لقطات تصميم بدون جهاز: `:app:recordRoborazziDebug`.
- `parkqr/play/` نصوص وصور جوجل بلاي + APP_PLAN.md. `parkqr/print/` ملصقات. `parkqr/video/` فيديو ريلز. `parkqr/cron-worker/` مؤقت للتصعيد.
- اقرأ: `parkqr/STATUS.md`, `parkqr/SECURITY.md`, `parkqr/site/DEPLOY.md`, `parkqr/site/WHATSAPP-SETUP.md`, `parkqr/play/APP_PLAN.md`.

## شو منجز
تسجيل، صندوق، ردود سريعة، حظر، حذف حساب، ملاحظة مفلترة، صورة من الكاميرا المباشرة فقط (إلزامية لمشاكل: ضربة/تسريب/شباك/أضواء)، محادثة قصيرة بصور (واتساب-ستايل) على الموقع والتطبيق، تنبيه ثاني تلقائي بعد دقيقتين، إشعارات Web Push، لوحة أرقام `/results` محمية بمفتاح (ADMIN_KEY بدّله المالك)، حماية: CSP/HSTS، حدود، حجم طلبات. تطبيق أندرويد (debug APK يبني ويشتغل على موبايل المالك). صفحات privacy و delete-account.
**الدخول بجوجل: السيرفر جاهز** (`/api/auth/google` + `_google.js` + اختبارات 21/21)، بيحتاج env `GOOGLE_CLIENT_ID` (Web client id، ويقبل عدة ids بفواصل). ما انربط بالتطبيق لسا.

## شو معلّق (بالترتيب المقترح)
1. **الدخول بجوجل:** المالك فتح Google Cloud (مشروع `orb-scanner-c06b7`، Google Auth Platform). لازم: Branding (اسم "يا نشمي") ← Clients ← Create client (Web) ← ينسخ **Client ID** (مش سرّي). بعدها: يحطه بكلاودفلير باسم `GOOGLE_CLIENT_ID`، وأنت تضيف الدخول بجوجل بالتطبيق (Credential Manager + googleid) وبتحتاج OAuth client من نوع Android (package `com.yanashmi.app` + SHA-1 للمفتاح) إذا لزم. ثم وقت الحذف/الدخول الجديد يتحدّث `privacy.html` (موجود فيه سطر إيميل جوجل).
2. **Cloudflare:** `VAPID_PUBLIC/VAPID_PRIVATE` لسا قديمين (مولّد بالصفحة `/results` بيعطي زوج جديد بدون ما يظهر السر). إيميل `info@yanashmi.com` (Email Routing) لسا ما اتعمل. Bot Fight Mode + Rate limiting rule على `/api/*`. ربط Workers AI باسم `AI` (فحص الصور اختياري).
3. **واتساب (Meta):** حساب أعمال Yanashmi وتطبيق `yanashmi` اتعملوا، ورقم تجريبي (+1 555 190 0834) جرّب يبعت. المفاتيح الحقيقية بدها: Business Verification (أوراق: سجل تجاري/رخصة مهن)، رقم خدمة حقيقي، قالب عربي موافق عليه. الكود جاهز (`_channels.js`)، يتفعّل بـ WA_TOKEN/WA_PHONE_ID/WA_TEMPLATE. الرنّة عبر Twilio + `cron-worker/` (CRON_KEY).
4. **جوجل بلاي:** حساب مطوّر شخصي موجود، التطبيق ما اتنشأ. بيحتاج غالباً اختبار مغلق (تأكد من العدد/المدة بلوحته). الملفات جاهزة بـ `parkqr/play/`. AAB موقّع: المالك لازم يحتفظ بمفتاح الرفع (ما تولّده وتضيّعه).
5. **FCM:** إشعارات فورية بالتطبيق بتحتاج مشروع Firebase (الآن فحص كل 15 دقيقة).
6. **الموقع الجغرافي، أكثر من سيارة، قفل بصمة، طلب ستيكر، صفحة أسعار:** لسا.

## قواعد الشغل
- كل تعديل: شغّل الفحوصات (npm test + e2e المتأثرة) قبل الـpush. ما تعطّل/تتجاوز فحص. commits بوصف واضح.
- ما تعمل PR إلا إذا طلب.
- أي تغيير بالواجهات: غيّر رقم النسخة `?v=` بكل ملفات html (cache).
- الأمان أولاً: كل استعلام SQL محضّر، ما تكتب أسرار بالملفات، ما تفتح CORS.
