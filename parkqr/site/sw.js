/* Ya Nashmi service worker: shows a notification when a message arrives, even when the site is closed. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) {}
  const title = d.title || 'يا نشمي';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'وصلتك رسالة جديدة',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'yn-msg',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    data: { url: d.url || '/inbox.html' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/inbox.html';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/inbox')) { await c.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});
