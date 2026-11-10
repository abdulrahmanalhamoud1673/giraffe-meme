# اختبارات يا نشمي

```bash
cd parkqr/tests
npm install        # مرة وحدة
npm test           # اختبارات الوحدة: الملفات، التحقق، الإشعارات، الـ API، الإحصائيات (بدون شبكة)
```

اختبارات المتصفح (تحتاج Playwright مثبّت):

```bash
npm run dev &                       # الموقع كامل محلياً على http://localhost:8788 مع قاعدة SQLite بالذاكرة
NODE_PATH=$(npm root -g) node e2e/journey.cjs            # تسجيل ← مسح ← رسالة ← رد
NODE_PATH=$(npm root -g) node e2e/register-validation.cjs
NODE_PATH=$(npm root -g) node e2e/survey.cjs
NODE_PATH=$(npm root -g) node e2e/chat.cjs
NODE_PATH=$(npm root -g) node e2e/notification-states.cjs
NODE_PATH=$(npm root -g) node e2e/nudge.cjs              # زر "ذكّره" والعدّاد وشارة التذكير ومتوسط الرد
NODE_PATH=$(npm root -g) node e2e/arabic-digits.cjs      # رقم مكتوب بلوحة مفاتيح عربية (٠٧٩...)
NODE_PATH=$(npm root -g) node e2e/save-image.cjs        # حفظ صورة الستيكر (PNG سليم 800x1000)
```

**ما بتغطيه:** منطق السيرفر على SQL حقيقي، وتشفير الإشعارات مقابل مكتبة مستقلة، وصفحات الموقع بمتصفح حقيقي.
**ما ما بتغطيه:** وصول الإشعار الحقيقي لجوجل/آبل، وصوت الموبايل، وسلوك Cloudflare نفسه. هدول لازم تجربهم بجهاز حقيقي.
