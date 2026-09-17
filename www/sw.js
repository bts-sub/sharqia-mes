/* عامل الخدمة لتطبيق «شرقية MES».
 *
 * الغرض: يشتغل التطبيق بعد تثبيته حتى لو الشبكة وقعت — وهذا شرط لازم
 * ليعرض المتصفّح خيار «تثبيت التطبيق» على أندرويد أصلًا.
 *
 * الإستراتيجية تختلف حسب نوع الملف:
 *  - الصفحة: من الكاش فورًا مع تحديثٍ خلفيّ، وإعادةُ تحميلٍ عند نشر نسخة.
 *  - env.js: الشبكة أولًا (الإعدادات الأحدث دائمًا)، والكاش شبكةَ أمان.
 *  - الأصول (أيقونات، وحدات src): من الكاش فورًا مع تحديثها في الخلفية،
 *    فتظهر النسخة الجديدة في الفتحة التالية بلا انتظار.
 *
 * عند كل نشر: غيّر VERSION ليُمسح الكاش القديم.
 */
const VERSION = 'sharqia-mes-v15';
const CORE = ['/', '/index.html', '/env.js', '/site.webmanifest?v=arch', '/favicon.ico?v=arch',
  '/assets/icon-192.png?v=arch', '/assets/icon-512.png?v=arch', '/assets/icon-180.png?v=arch', '/assets/icon-32.png?v=arch'];

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
    // نسخةٌ جديدة نُشرت: أعِد تحميل النوافذ المفتوحة. التطبيق المثبَّت على
    // الجوال لا يُغلق، فلولا هذا بقي صاحبه على القديم بلا أن يدري.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      try { if (typeof c.navigate === 'function') await c.navigate(c.url); else c.postMessage('RELOAD'); }
      catch (_) { c.postMessage('RELOAD'); }
    }
  })());
});

// تنزيل الصفحة والتحقّق من تمامها قبل حفظها: ردٌّ مبتورٌ (انقطعت الشبكة في
// منتصفه) يصل بحالة 200 كأنه سليم، ولو خُزِّن بقي التطبيق لا يفتح.
async function fetchWhole(req) {
  const res = await fetch(req);
  if (!res || !res.ok) return res;
  const body = await res.clone().text();
  const len = Number(res.headers.get('content-length') || 0);
  const whole = body.trimEnd().endsWith('</html>') &&
    (!len || len === new TextEncoder().encode(body).length);
  if (!whole) return (await caches.match('/index.html')) || new Response(body, { headers: res.headers });
  (await caches.open(VERSION)).put('/index.html', res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // الخطوط الخارجية تمرّ كما هي
  // الخادم وحده يعرف الجلسة والبيانات: ردٌّ مخبوء من /api/mes/me يُدخل
  // مستخدمًا خرج، ويعرض أرقامًا قديمة كأنها حيّة.
  if (url.pathname.startsWith('/api/')) return;

  // الصفحة المحفوظة تُعرض فورًا، والشبكة تُحدّثها خلفَها؛ ومتى نُزّلت نسخةٌ
  // جديدة أعاد عاملُ الخدمة تحميل النافذة. كانت الشبكة أولًا، فكل فتحةٍ
  // تنتظر نحو نصف ميجابايت قبل أن يظهر شيء.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match('/index.html');
      const net = fetchWhole(req).catch(() => null);
      if (cached) { e.waitUntil(net); return cached; }
      return (await net) ||
        new Response('غير متصل', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  if (url.pathname === '/env.js') {                            // الإعدادات: الشبكة أولًا
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) (await caches.open(VERSION)).put(req, res.clone());
        return res;
      } catch (_) {
        return (await caches.match(req))
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
