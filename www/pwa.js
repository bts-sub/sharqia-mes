/* تثبيت التطبيق على شاشة الهاتف.
 *
 * يسجّل عامل الخدمة، ويعرض زرّ «تثبيت التطبيق» فقط حين يكون التثبيت متاحًا
 * فعلًا. أندرويد يعطينا حدث beforeinstallprompt؛ أمّا iOS فلا يعطي شيئًا،
 * فنعرض له تعليمات «مشاركة ← إضافة إلى الشاشة الرئيسية» بدل زرٍّ لا يفعل شيئًا.
 */
(function () {
  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  if (!isHttp) return;                                  // داخل غلاف Capacitor لا لزوم لعامل الخدمة
  if ('serviceWorker' in navigator)
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) return;                               // مثبَّت بالفعل
  if (localStorage.getItem('sharqia_install_dismissed') === '1') return;

  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  let deferred = null;

  const el = document.createElement('div');
  el.dir = 'rtl';
  el.style.cssText = 'position:fixed;inset-inline:0;bottom:14px;margin-inline:auto;width:max-content;max-width:92vw;' +
    'display:none;align-items:center;gap:10px;z-index:2147483000;background:#0C0C0A;color:#fff;' +
    'border:1px solid #F5C400;border-radius:999px;padding:9px 12px 9px 16px;' +
    "font:600 13.5px/1.4 Cairo,system-ui,'Segoe UI',Tahoma,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)";
  el.innerHTML =
    '<img src="/assets/icon-192.png" alt="" width="30" height="30" style="border-radius:8px;flex:none">' +
    '<span id="sq-install-text">ثبّت التطبيق على شاشتك</span>' +
    '<button id="sq-install-go" style="background:#F5C400;color:#17170F;border:0;border-radius:999px;' +
    "padding:6px 14px;font:800 13px Cairo,system-ui,sans-serif;cursor:pointer\">تثبيت</button>" +
    '<button id="sq-install-x" aria-label="إغلاق" style="background:transparent;color:#9A9A8C;border:0;' +
    'font-size:17px;cursor:pointer;line-height:1;padding:2px 4px">✕</button>';

  const show = () => { document.body.appendChild(el); el.style.display = 'flex'; };

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; show(); });
  window.addEventListener('appinstalled', () => { el.remove(); localStorage.setItem('sharqia_install_dismissed', '1'); });

  document.addEventListener('click', async (ev) => {
    if (ev.target.id === 'sq-install-x') { el.remove(); localStorage.setItem('sharqia_install_dismissed', '1'); return; }
    if (ev.target.id !== 'sq-install-go') return;
    if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; el.remove(); }
    else if (iOS) document.getElementById('sq-install-text').textContent = 'اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»';
  });

  // iOS لا يطلق beforeinstallprompt أبدًا: نعرض التعليمات بعد أن تستقرّ الصفحة
  if (iOS) window.addEventListener('load', () => setTimeout(() => {
    document.getElementById('sq-install-go').textContent = 'كيف؟';
    show();
  }, 2500));
})();
