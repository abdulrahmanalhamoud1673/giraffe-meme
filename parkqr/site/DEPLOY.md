# نشر الموقع على yanashmi.com (Cloudflare Pages) — مرة وحدة، حوالي 15 دقيقة

كله مجاني. الموقع بسيط: صفحة + استبيان + قاعدة بيانات صغيرة (D1).

## 1) قاعدة البيانات
1. Cloudflare Dashboard ← **Storage & databases** ← **D1 SQL database** ← **Create** باسم `yanashmi`.
2. افتح القاعدة ← **Console**، الصق **كل** محتوى `schema.sql` (بيحتوي جداول الاستبيان والسيارات والرسائل) واضغط Execute.

## 2) الموقع
1. **Compute** ← **Workers & Pages** ← **Create** ← **Pages** ← **Connect to Git** ← اختر GitHub ثم مستودع `giraffe-meme` (وافق على صلاحية Cloudflare للمستودع).
2. Production branch: `claude/gallant-cerf-ggjn2q` (أو `main` بعد الدمج).
3. **Root directory:** `parkqr/site` — Build command: فاضي — Output directory: `/` (أو فاضي).
4. **Save and Deploy**.

## 3) ربط القاعدة والمفتاح
في المشروع ← **Settings** ← **Bindings** ← **Add** ← **D1 database**: Variable name `DB` ← اختر `yanashmi`.
**Variables and secrets** ← أضف سرّين (Secret): `ADMIN_KEY` و`SALT`، كل واحد بنص طويل عشوائي من عندك. ثم أعد النشر (Deployments ← Retry).

## 4) الدومين
المشروع ← **Custom domains** ← **Set up a domain** ← `yanashmi.com`. (الدومين عندك على Cloudflare فبيربط تلقائياً.)

## 5) نتائج الاستبيان
افتح `https://yanashmi.com/results.html` وأدخل `ADMIN_KEY`. الهدف: أكثر من 40% "أكيد/غالباً".

## 6) تجربة الرحلة كاملة (بعد النشر)
1. افتح `yanashmi.com/register.html` من موبايلك وسجّل. بيطلعلك رمز QR وصندوق رسائل.
2. بموبايل ثاني امسح الرمز (أو افتح `yanashmi.com/c/<الرمز>`) وأرسل رسالة.
3. افتح صندوقك وردّ، وشوف الرد يظهر عند المرسل.

## ملاحظات
- التنبيهات التلقائية (إشعار/واتساب) لسا مش مبنية؛ هلأ صاحب السيارة بيفتح صندوقه بنفسه.
- التسجيل هلأ بدون تحقق من الرقم (OTP). لازم نضيفه قبل أي إرسال فعلي لأرقام، عشان ما حدا يسجّل رقم غيره.
