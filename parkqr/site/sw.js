/* Ya Nashmi service worker: shows a notification when a message arrives, even when the site is closed. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) {}
  const title = d.title || 'يا نشمي';
  event.waitUntil((async () => {
    // If the inbox is open, let it refresh and play its own chime right away.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) w.postMessage({ type: 'yn-push' });
    await self.registration.showNotification(title, {
      body: d.body || 'وصلتك رسالة جديدة',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: d.tag || 'yn-msg',
      renotify: true,
      requireInteraction: true,       // stays until you act on it (where the device supports it)
      vibrate: d.urgent ? [500, 150, 500, 150, 500, 150, 800] : [250, 120, 250, 120, 500],
      dir: 'rtl',
      lang: 'ar',
      data: { url: d.url || '/inbox.html' },
    });
  })());
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
