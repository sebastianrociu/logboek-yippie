/* shared/version-check.js - registreert de service worker en let op nieuwe versies.
   Pingt /api/version bij laden en bij terugkeer naar het tabblad; toont een
   balk met een echte "Vernieuwen"-knop als het serverversienummer afwijkt.
   Classic script. */
(function (w) {
  var YP = w.YP || (w.YP = {});
  var seen = null;
  var barGetoond = false;

  function toonUpdateBalk() {
    if (barGetoond || document.getElementById('yp-update-bar')) return;
    barGetoond = true;
    var bar = document.createElement('div');
    bar.id = 'yp-update-bar';
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    var tekst = document.createElement('span');
    tekst.textContent = 'Er is een nieuwe versie.';
    var knop = document.createElement('button');
    knop.type = 'button';
    knop.className = 'btn btn-primary';
    knop.textContent = 'Vernieuwen';
    knop.addEventListener('click', function () { location.reload(); });
    var sluit = document.createElement('button');
    sluit.type = 'button';
    sluit.className = 'ub-x';
    sluit.setAttribute('aria-label', 'Later');
    sluit.innerHTML = YP.icon ? YP.icon('close', { size: 16 }) : '×';
    sluit.addEventListener('click', function () { bar.remove(); });
    bar.appendChild(tekst);
    bar.appendChild(knop);
    bar.appendChild(sluit);
    document.body.appendChild(bar);
  }

  async function check() {
    try {
      var r = await fetch('/api/version', { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) return;
      var j = await r.json();
      if (seen == null) { seen = j.version; return; }
      if (j.version && j.version !== seen) {
        seen = j.version;
        toonUpdateBalk();
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
