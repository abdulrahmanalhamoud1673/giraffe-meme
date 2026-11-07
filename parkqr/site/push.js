/* Ya Nashmi: browser notifications (Web Push) for the owner's inbox. Depends on shared.js (api, ICON). */
const Push = (() => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid;
  const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const demo = new URLSearchParams(location.search).get('demo');

  const toBytes = (s) => {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  };

  async function currentSub() {
    if (!supported) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  }

  // 'enabled' | 'ready' | 'denied' | 'ios-install' | 'unsupported'
  async function state() {
    if (demo) return demo === 'desktop' || demo === 'android' ? 'ready' : demo === 'ios' ? 'ios-install' : demo;
    if (isIOS && !standalone) return 'ios-install';
    if (!supported) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const sub = await currentSub();
    return Notification.permission === 'granted' && sub ? 'enabled' : 'ready';
  }

  // Must be called straight from a tap (browsers and iOS require a user gesture).
  async function enable(headers) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: perm };
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let k;
    try { k = (await api('/push-key')).key; } catch (e) { return { ok: false, reason: e.status === 503 ? 'not_configured' : 'key' }; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(k) });
    await api('/push-subscribe', { method: 'POST', headers, body: JSON.stringify(sub.toJSON()) });
    return { ok: true };
  }

  // Keeps the server in sync (idempotent). Safe to call on every page load.
  async function resync(headers) {
    if (!supported || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      if (sub) await api('/push-subscribe', { method: 'POST', headers, body: JSON.stringify(sub.toJSON()) });
    } catch (_) {}
  }

  async function disable(headers) {
    const sub = await currentSub();
    if (sub) {
      try { await api('/push-unsubscribe', { method: 'POST', headers, body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch (_) {}
      await sub.unsubscribe();
    }
  }

  async function test(headers) {
    return api('/push-test', { method: 'POST', headers, body: '{}' });
  }

  return { isIOS, isAndroid, isMobile, standalone, supported, state, enable, resync, disable, test, demo };
})();
