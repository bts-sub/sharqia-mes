/* عامل الخدمة لتطبيق «شرقية MES».
 *
 * الغرض: يشتغل التطبيق بعد تثبيته حتى لو الشبكة وقعت — وهذا شرط لازم
 * ليعرض المتصفّح خيار «تثبيت التطبيق» على أندرويد أصلًا.
 *
 * الإستراتيجية تختلف حسب نوع الملف:
 *  - صفحات التنقّل و env.js: الشبكة أولًا (الأحدث دائمًا)، والكاش شبكةَ أمان.
 *  - الأصول (أيقونات، وحدات src): من الكاش فورًا مع تحديثها في الخلفية،
 *    فتظهر النسخة الجديدة في الفتحة التالية بلا انتظار.
 *
 * عند كل نشر: غيّر VERSION ليُمسح الكاش القديم.
 */
const VERSION = 'sharqia-mes-v2';
const CORE = ['/', '/index.html', '/env.js', '/site.webmanifest', '/favicon.ico',
  '/assets/icon-192.png', '/assets/icon-512.png', '/assets/icon-180.png', '/assets/icon-32.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // cache:'reload' يتخطّى كاش المتصفّح: index.html و env.js مضبوطان no-store
    await Promise.allSettled(CORE.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // الخطوط الخارجية تمرّ كما هي

  const fresh = req.mode === 'navigate' || url.pathname === '/env.js';
  if (fresh) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req.mode === 'navigate' ? '/index.html' : req, res.clone());
        return res;
      } catch (_) {
        return (await caches.match(req.mode === 'navigate' ? '/index.html' : req))
            || new Response('غير متصل', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  e.respondWith((async () => {                                // كاش أولًا + تحديث صامت
    const hit = await caches.match(req);
    const net = fetch(req).then((res) => {
      if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => null);
    return hit || (await net) || new Response('', { status: 504 });
  })());
});
