/* shared/dialog.js - toast (Popover-API, top-layer) + confirm/alert helpers.
   Global: window.YP.toast(), YP.confirm(), YP.alert(). Classic script. */
(function (w) {
  var YP = w.YP || (w.YP = {});

  function ensureToast() {
    var el = document.getElementById('yp-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'yp-toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('popover', 'manual');
      el.innerHTML = '<span class="ti"></span><span class="tt"></span>';
      document.body.appendChild(el);
    }
    return el;
  }

  // Klein leidend icoon voor ok / fout; anders alleen tekst.
  function toastIcon(kind) {
    if (!YP.icon) return '';
    if (kind === 'ok') return YP.icon('check', { size: 16 });
    if (kind === 'bad') return YP.icon('alert', { size: 16 });
    return '';
  }

  var toastTimer = null;
  YP.toast = function (msg, kind) {
    var el = ensureToast();
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.querySelector('.ti').innerHTML = toastIcon(kind);
    el.querySelector('.tt').textContent = msg;
    if (el.showPopover) { try { el.hidePopover(); } catch (e) {} try { el.showPopover(); } catch (e) {} }
    // reflow so the transition re-triggers
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.hidePopover) { try { el.hidePopover(); } catch (e) {} } }, 250);
    }, kind === 'bad' ? 4200 : 2600);
  };

  // Lightweight promise-based confirm using a generated <dialog>.
  function buildDialog(opts) {
    var dlg = document.createElement('dialog');
    dlg.innerHTML =
      '<form method="dialog" class="dlg">' +
        '<h3></h3><p class="dsub"></p>' +
        '<div class="dlg-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-no></button>' +
          '<button type="submit" class="btn btn-sm" data-yes></button>' +
        '</div>' +
      '</form>';
    dlg.querySelector('h3').textContent = opts.title || 'Bevestigen';
    dlg.querySelector('.dsub').textContent = opts.body || '';
    var no = dlg.querySelector('[data-no]'); no.textContent = opts.cancel || 'Annuleren';
    var yes = dlg.querySelector('[data-yes]'); yes.textContent = opts.ok || 'Doorgaan';
    yes.classList.add(opts.danger ? 'btn-danger' : 'btn-primary');
    if (opts.alertOnly) no.style.display = 'none';
    document.body.appendChild(dlg);
    return dlg;
  }

  function openDialog(opts) {
    return new Promise(function (resolve) {
      var dlg = buildDialog(opts);
      var done = false;
      function finish(val) { if (done) return; done = true; try { dlg.close(); } catch (e) {} dlg.remove(); resolve(val); }
      dlg.querySelector('[data-no]').addEventListener('click', function () { finish(false); });
      dlg.addEventListener('submit', function () { finish(true); });
      dlg.addEventListener('cancel', function () { finish(false); });
      dlg.showModal();
    });
  }

  YP.confirm = function (title, body, opts) {
    opts = opts || {};
    return openDialog({ title: title, body: body, ok: opts.ok, cancel: opts.cancel, danger: opts.danger });
  };
  YP.alert = function (title, body, ok) {
    return openDialog({ title: title, body: body, ok: ok || 'Oke', alertOnly: true });
  };

  // Close-on-any-button helper: any element with [data-close] closes its <dialog>.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-close]');
    if (b) { var d = b.closest('dialog'); if (d) d.close(); }
  });

  // Uitleg-dialoog: open het <dialog id="introDialog"> van de pagina.
  // me-badge.js tekent de ?-knop in de header en roept dit bij de eerste keer.
  YP.help = function (id) {
    var d = document.getElementById(id || 'introDialog');
    if (d && d.showModal) { try { d.showModal(); } catch (e) {} }
  };
})(window);
