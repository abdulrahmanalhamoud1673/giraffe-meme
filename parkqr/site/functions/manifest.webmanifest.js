// Dynamic web app manifest: when the owner installs the site to the home screen, it must open THEIR inbox
// (iPhone keeps a separate storage for installed web apps, so the inbox key travels in the start URL).
export async function onRequestGet({ request }) {
  const k = new URL(request.url).searchParams.get('k') || '';
  const key = /^[a-z0-9]{16,40}$/.test(k) ? k : '';
  const manifest = {
    name: 'يا نشمي',
    short_name: 'يا نشمي',
    description: 'صندوق رسائل سيارتك',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/inbox.html' + (key ? '#' + key : ''),
    scope: '/',
    display: 'standalone',
    background_color: '#0b0d0c',
    theme_color: '#0b0d0c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'no-store' } });
}
