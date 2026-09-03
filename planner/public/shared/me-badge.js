/* shared/me-badge.js - gedeelde coral topbar + sessie-badge + uitloggen.
   Gebruik: <header id="yp-topbar" data-title="Beheer" data-sub="Yippie voor de klas"></header>
   Het script vult 'm, haalt /api/me op en zet YP.me (Promise).
   data-auth="beheerder|resource|mentor" => stuurt naar /?next=... als de rol niet klopt.
   Classic script; laad na shared/api.js. */
(function (w) {
  var YP = w.YP || (w.YP = {});
  // Yippie-logo uit het logboek. De topbar-CSS zet er
  // filter:brightness(0) invert(1) op zodat het wit wordt op de coral header.
  var LOGO = '/assets/logo.png';

  var ROLNAAM = { beheerder: 'Beheerder', resource: 'Begeleider', mentor: 'Mentor', ouder: 'Leerling of ouder' };

  function initials(naam) {
    var p = String(naam || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function voornaam(naam) {
    return String(naam || '').trim().split(/\s+/)[0] || '';
  }
  function groetWoord() {
    var h = new Date().getHours();
    return h < 12 ? 'Goedemorgen' : (h < 18 ? 'Goedemiddag' : 'Goedenavond');
  }
  function langeDatum() {
    var d = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  function render(host, me) {
    var title = host.getAttribute('data-title') || 'Yippie voor de klas';
    var heeftUitleg = !!document.getElementById('introDialog');
    var helpBtn = heeftUitleg
      ? '<button class="hdr-profile" id="yp-help" type="button" title="Hoe werkt het?" aria-label="Hoe werkt het?">' +
        (YP.icon ? YP.icon('help', { size: 19 }) : '?') + '</button>'
      : '';
    var ingelogd = !!(me && me.rol);
    var avatar = ingelogd
      ? '<button class="hdr-profile" id="yp-profile" type="button" aria-haspopup="menu" aria-expanded="false" title="Menu">' + YP.esc(initials(me.naam || me.rol)) + '</button>'
      : '<a class="hdr-pill" href="/">Inloggen</a>';
    var menu = ingelogd
      ? '<div class="hdr-menu" id="yp-menu" role="menu" hidden>' +
          '<div class="hm-head"><div class="hm-naam">' + YP.esc(me.naam || '') + '</div>' +
          '<div class="hm-rol">' + YP.esc(ROLNAAM[me.rol] || me.rol) + '</div></div>' +
          (heeftUitleg ? '<button class="hm-item" id="yp-menu-help" role="menuitem" type="button">' + (YP.icon ? YP.icon('help', { size: 16 }) : '') + ' Hoe werkt het?</button>' : '') +
          '<button class="hm-item danger" id="yp-menu-logout" role="menuitem" type="button">' + (YP.icon ? YP.icon('logout', { size: 16 }) : '') + ' Uitloggen</button>' +
        '</div>'
      : '';
    var greet = me && me.naam ? (groetWoord() + ' ' + voornaam(me.naam)) : 'Yippie voor de klas';
    host.className = 'topbar';
    host.innerHTML =
      '<div class="topbar-in">' +
        '<a class="brand" href="/" aria-label="Yippie voor de klas"><img src="' + LOGO + '" alt="Yippie"></a>' +
        '<div class="hello">' +
          '<div class="greet">' + YP.esc(greet) + '</div>' +
          '<h1>' + YP.esc(title) + '</h1>' +
          '<div class="subline">' + YP.esc(langeDatum()) + '</div>' +
        '</div>' +
        '<div class="hdr-actions">' + (ingelogd ? '' : helpBtn) + avatar + menu + '</div>' +
      '</div>' +
      '<div class="hdr-wave"></div>';

    var hb = document.getElementById('yp-help');
    if (hb) hb.addEventListener('click', function () { if (YP.help) YP.help('introDialog'); });

    var doLogout = async function () {
      try { await YP.api.post('/api/logout'); } catch (e) { /* ignore */ }
      location.href = '/';
    };

    var prof = document.getElementById('yp-profile');
    var menuEl = document.getElementById('yp-menu');
    if (prof && menuEl) {
      // De topbar heeft overflow:hidden; hang het menu aan de body en positioneer 'm vast.
      document.body.appendChild(menuEl);
      menuEl.style.position = 'fixed';
      var plaats = function () {
        var r = prof.getBoundingClientRect();
        menuEl.style.top = (r.bottom + 8) + 'px';
        menuEl.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
      };
      var toggle = function (open) {
        var verberg = open == null ? !menuEl.hidden : !open;
        if (!verberg) plaats();
        menuEl.hidden = verberg;
        prof.setAttribute('aria-expanded', String(!verberg));
      };
      window.addEventListener('resize', function () { if (!menuEl.hidden) plaats(); });
      prof.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      document.addEventListener('click', function (e) { if (!menuEl.hidden && !menuEl.contains(e.target)) toggle(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menuEl.hidden) { toggle(false); prof.focus(); } });
      var mh = document.getElementById('yp-menu-help');
      if (mh) mh.addEventListener('click', function () { toggle(false); if (YP.help) YP.help('introDialog'); });
      document.getElementById('yp-menu-logout').addEventListener('click', doLogout);
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
        return me;
      }
      // Uitleg-dialoog de eerste keer automatisch tonen (per pagina onthouden).
      try {
        var vlag = 'yp_intro_' + location.pathname;
        if (document.getElementById('introDialog') && !localStorage.getItem(vlag)) {
          if (YP.help) YP.help('introDialog');
          localStorage.setItem(vlag, '1');
        }
      } catch (e) {}
    }
    return me;
  })();
})(window);
