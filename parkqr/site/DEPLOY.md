# نشر الموقع على yanashmi.com (Cloudflare Pages) — مرة وحدة، حوالي 15 دقيقة

كله مجاني. الموقع بسيط: صفحة + استبيان + قاعدة بيانات صغيرة (D1).

## 1) قاعدة البيانات
1. Cloudflare Dashboard ← **Storage & databases** ← **D1 SQL database** ← **Create** باسم `yanashmi`.
2. افتح القاعدة ← **Console**، الصق محتوى `schema.sql` واضغط Execute.

## 2) الموقع
1. **Compute** ← **Workers & Pages** ← **Create** ← **Pages** ← **Connect to Git** ← اختر GitHub ثم مستودع `giraffe-meme` (وافق على صلاحية Cloudflare للمستودع).
2. Production branch: `claude/gallant-cerf-ggjn2q` (أو `main` بعد الدمج).
3. **Root directory:** `parkqr/site` — Build command: فاضي — Output directory: `/` (أو فاضي).
4. **Save and Deploy**.

## 3) ربط القاعدة والمفتاح
في المشروع ← **Settings** ← **Bindings** ← **Add** ← **D1 database**: Variable name `DB` ← اختر `yanashmi`.
**Variables and secrets** ← أضف `ADMIN_KEY` (Secret) بكلمة سر طويلة من عندك. ثم أعد النشر (Deployments ← Retry).

## 4) الدومين
المشروع ← **Custom domains** ← **Set up a domain** ← `yanashmi.com`. (الدومين عندك على Cloudflare فبيربط تلقائياً.)

## 5) نتائج الاستبيان
افتح `https://yanashmi.com/results.html` وأدخل `ADMIN_KEY`. الهدف: أكثر من 40% "أكيد/غالباً".
