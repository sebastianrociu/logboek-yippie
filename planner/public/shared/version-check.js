/* shared/version-check.js - registreert de service worker en let op nieuwe versies.
   Pingt /api/version bij laden en bij terugkeer naar het tabblad; toont een
   toast met "herladen" als het serverversienummer afwijkt. Classic script. */
(function (w) {
  var YP = w.YP || (w.YP = {});
  var seen = null;

  async function check() {
    try {
      var r = await fetch('/api/version', { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) return;
      var j = await r.json();
      if (seen == null) { seen = j.version; return; }
      if (j.version && j.version !== seen) {
        seen = j.version;
        if (YP.toast) YP.toast('Nieuwe versie beschikbaar. Tik om te herladen.', 'ok');
        var t = document.getElementById('yp-toast');
        if (t) t.addEventListener('click', function () { location.reload(); }, { once: true });
      }
    } catch (e) {}
  }

  if ('serviceWorker' in navigator) {
    w.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  check();
})(window);
