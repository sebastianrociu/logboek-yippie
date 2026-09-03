/* shared/me-badge.js - gedeelde coral topbar + sessie-badge + uitloggen.
   Gebruik: <header id="yp-topbar" data-title="Beheer" data-sub="Yippie voor de klas"></header>
   Het script vult 'm, haalt /api/me op en zet YP.me (Promise).
   data-auth="beheerder|resource|mentor" => stuurt naar /?next=... als de rol niet klopt.
   Classic script; laad na shared/api.js. */
(function (w) {
  var YP = w.YP || (w.YP = {});
  // Boek-silhouet (transparante achtergrond). De topbar-CSS zet er
  // filter:brightness(0) invert(1) op zodat het wit wordt op de coral header.
  var LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBkPSJNMjU2IDEzMCBDMjAwIDEwMCAxMjAgOTYgODQgMTA0IFY0MDAgQzEyMCAzOTIgMjAwIDM5NiAyNTYgNDIwIFoiIGZpbGw9IiNFODczNUEiLz48cGF0aCBkPSJNMjU2IDEzMCBDMzEyIDEwMCAzOTIgOTYgNDI4IDEwNCBWNDAwIEMzOTIgMzkyIDMxMiAzOTYgMjU2IDQyMCBaIiBmaWxsPSIjRTg3MzVBIi8+PHJlY3QgeD0iMjQ2IiB5PSIxMjgiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyOTYiIHJ4PSI2IiBmaWxsPSIjQzk1QTQzIi8+PC9zdmc+';

  var ROLNAAM = { beheerder: 'Beheerder', resource: 'Begeleider', mentor: 'Mentor', ouder: 'Leerling of ouder' };

  function initials(naam) {
    var p = String(naam || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  function render(host, me) {
    var title = host.getAttribute('data-title') || 'Yippie voor de klas';
    var sub = host.getAttribute('data-sub') || 'Plannings- en inschrijfsysteem';
    var right = '';
    if (me && me.rol) {
      right =
        '<span class="hdr-pill" id="yp-logout" role="button" tabindex="0">Uitloggen</span>' +
        '<span class="hdr-profile" title="' + YP.esc((me.naam || '') + ' - ' + (ROLNAAM[me.rol] || me.rol)) + '">' +
          YP.esc(initials(me.naam || me.rol)) + '</span>';
    } else {
      right = '<a class="hdr-pill" href="/">Inloggen</a>';
    }
    host.className = 'topbar';
    host.innerHTML =
      '<div class="topbar-in">' +
        '<a class="brand" href="/"><img src="' + LOGO + '" alt=""><span class="bname">Yippie</span></a>' +
        '<div class="hello">' +
          '<div class="greet">' + YP.esc(me && me.naam ? 'Ingelogd als ' + me.naam : 'Yippie voor de klas') + '</div>' +
          '<h1>' + YP.esc(title) + '</h1>' +
          '<div class="subline">' + YP.esc(sub) + '</div>' +
        '</div>' +
        '<div class="hdr-actions">' + right + '</div>' +
      '</div>' +
      '<div class="hdr-wave"></div>';

    var lo = document.getElementById('yp-logout');
    if (lo) {
      var doLogout = async function () {
        try { await YP.api.post('/api/logout'); } catch (e) {}
        location.href = '/';
      };
      lo.addEventListener('click', doLogout);
      lo.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doLogout(); } });
    }
  }

  YP.me = (async function () {
    var host = document.getElementById('yp-topbar');
    var me = null;
    try { me = await YP.api.get('/api/me'); } catch (e) { me = null; }
    if (host) {
      render(host, me);
      var need = host.getAttribute('data-auth');
      if (need && (!me || me.rol !== need)) {
        location.href = '/?next=' + encodeURIComponent(location.pathname) + '&rol=' + encodeURIComponent(need);
      }
    }
    return me;
  })();
})(window);
