/* shared/api.js - fetch-wrapper voor de planner-API.
   - stuurt/ontvangt JSON, cookies gaan automatisch mee (same-origin)
   - vertaalt niet-ok responses naar een Error met .status en .data
   - api.save() doet optimistic-lock retries: bij 409 (rev-conflict) haalt de
     server de nieuwe versie op, de caller krijgt { conflict:true, latest } terug
   Global: window.YP.api. Classic script. */
(function (w) {
  var YP = w.YP || (w.YP = {});

  async function req(method, path, body) {
    var res = await fetch(path, {
      method: method,
      headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store'
    });
    var data = null;
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('application/json') !== -1) { try { data = await res.json(); } catch (e) {} }
    if (!res.ok) {
      var err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  var api = {
    get: function (p) { return req('GET', p); },
    post: function (p, b) { return req('POST', p, b || {}); },
    put: function (p, b) { return req('PUT', p, b || {}); },
    del: function (p) { return req('DELETE', p); },

    /* save(path, mutator): read section, apply mutator(section), PUT with _rev.
       Retries up to 3x on a 409 by re-reading. mutator gets a deep copy. */
    save: async function (path, mutator, tries) {
      tries = tries || 3;
      for (var i = 0; i < tries; i++) {
        var current = await req('GET', path);
        var next = JSON.parse(JSON.stringify(current));
        mutator(next, current);
        try {
          return await req('PUT', path, next);
        } catch (e) {
          if (e.status === 409 && i < tries - 1) { await sleep(120 * (i + 1)); continue; }
          throw e;
        }
      }
    }
  };

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  YP.api = api;
  YP.sleep = sleep;

  // Small DOM helpers used across pages.
  YP.el = function (tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  };
  YP.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
})(window);
