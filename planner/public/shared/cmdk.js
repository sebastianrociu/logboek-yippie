/* shared/cmdk.js - Cmd/Ctrl+K snelzoeker.
   Een pagina registreert items:  YP.cmdk.register([{label, hint, run}])
   Zonder registratie toont het paneel alleen de vaste navigatie. Classic script. */
(function (w) {
  var YP = w.YP || (w.YP = {});
  var NAV = [
    { label: 'Inschrijven', hint: 'Publiek formulier', run: function () { location.href = '/inschrijven/'; } },
    { label: 'Beheer', hint: 'Yippie', run: function () { location.href = '/beheer/'; } },
    { label: 'Mijn indeling', hint: 'Leerling of ouder', run: function () { location.href = '/mijn/'; } },
    { label: 'Mijn rooster', hint: 'Begeleider', run: function () { location.href = '/resource/'; } },
    { label: 'Schooloverzicht', hint: 'Mentor', run: function () { location.href = '/school/'; } }
  ];
  var extra = [];

  var dlg, input, list;
  function build() {
    dlg = document.createElement('dialog');
    dlg.id = 'yp-cmdk';
    dlg.style.maxWidth = '520px';
    dlg.innerHTML =
      '<div class="dlg" style="padding:14px">' +
        '<input class="input" id="yp-cmdk-in" placeholder="Zoeken of navigeren..." autocomplete="off">' +
        '<div class="list" id="yp-cmdk-list" style="margin-top:10px;max-height:46vh;overflow-y:auto"></div>' +
      '</div>';
    document.body.appendChild(dlg);
    input = dlg.querySelector('#yp-cmdk-in');
    list = dlg.querySelector('#yp-cmdk-list');
    input.addEventListener('input', paint);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var f = list.querySelector('.list-row'); if (f) f.click(); }
    });
    dlg.addEventListener('close', function () { input.value = ''; });
  }

  function paint() {
    var q = input.value.trim().toLowerCase();
    var all = NAV.concat(extra);
    var hits = all.filter(function (i) { return !q || i.label.toLowerCase().indexOf(q) !== -1 || (i.hint || '').toLowerCase().indexOf(q) !== -1; });
    list.innerHTML = '';
    if (!hits.length) { list.innerHTML = '<div class="empty">Niets gevonden</div>'; return; }
    hits.forEach(function (i) {
      var row = YP.el('button', { class: 'list-row', type: 'button', style: 'width:100%;text-align:left;background:none;border:0;cursor:pointer' }, [
        YP.el('span', { class: 'lr-main' }, [
          YP.el('span', { class: 'lr-title', text: i.label }),
          i.hint ? YP.el('span', { class: 'lr-sub', text: i.hint }) : null
        ])
      ]);
      row.addEventListener('click', function () { dlg.close(); i.run(); });
      list.appendChild(row);
    });
  }

  YP.cmdk = {
    register: function (items) { extra = extra.concat(items || []); },
    open: function () { if (!dlg) build(); paint(); dlg.showModal(); setTimeout(function () { input.focus(); }, 30); }
  };

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); YP.cmdk.open(); }
  });
})(window);
