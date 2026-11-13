(function () {
  'use strict';

  /* ============ Configuración ============ */

  // Contraseña: se guarda solo su huella (hash), no el texto.
  // Para cambiarla, ejecuta scripts/hash_password.py y pega aquí SALT y HASH.
  var SALT = '57acdf4dabe5c0e3';
  var ITER = 200000;
  var HASH = '36d2c6e24ca79e1b901071ac5861fc5e46439f14e67d1549655a291f52b77408';
  var STORE_KEY = 'sc_auth';

  // Secciones de la web. Para añadir una, añade una línea aquí y crea su carpeta.
  var SECTIONS = [
    { id: 'diapositivas', name: 'Diapositivas', desc: 'Presentaciones, ordenadas por asignatura.',
      kind: 'folders', noun: 'asignatura', nouns: 'asignaturas', back: 'Asignaturas' },
    { id: 'organizacion', name: 'Organización', desc: 'Reuniones, tareas, objetivos y procesos.',
      kind: 'folders', noun: 'carpeta', nouns: 'carpetas', back: 'Carpetas' },
    { id: 'recursos', name: 'Recursos', desc: 'Enlaces, PDF y material que me sirve.', kind: 'recursos' },
    { id: 'prompts', name: 'Prompts', desc: 'Los que uso siempre, listos para copiar.', kind: 'prompts' }
  ];

  /* ============ Utilidades ============ */

  var ROOT = document.body.getAttribute('data-root') || '';
  var PAGE = document.body.getAttribute('data-page') || 'home';

  function h(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function cmp(a, b) { return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }); }

  function encodePath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

  function nice(name) {
    name = name.normalize('NFC').trim();
    if (name.indexOf(' ') < 0) name = name.replace(/[-_]+/g, ' ');
    return name.replace(/\s+/g, ' ');
  }

  function baseName(p) { return p.slice(p.lastIndexOf('/') + 1); }

  function fileTitle(p) { return nice(baseName(p).replace(/\.[^.]+$/, '')); }

  function fileExt(p) {
    var m = baseName(p).match(/\.([^.]+)$/);
    return m ? m[1].toUpperCase().slice(0, 5) : '';
  }

  function getText(path) {
    return fetch(ROOT + path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }

  function getManifest() {
    return fetch(ROOT + 'manifest.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function optionalText(path) { return getText(path).catch(function () { return ''; }); }

  function errorNote(main) {
    main.appendChild(h('p', { class: 'note',
      text: 'No se pudo cargar el contenido. Esta página funciona una vez publicada en GitHub Pages; ' +
            'si la abres directamente desde tu ordenador, no puede leer las carpetas.' }));
  }

  function emptyNote(text, code) {
    return h('p', { class: 'note' }, text + ' ', h('code', { text: code }));
  }

  /* ============ Lectura de archivos de texto ============ */

  // prompts.md: cada prompt empieza con "## Título"
  function parsePrompts(md) {
    var out = [], cur = null;
    md.replace(/\r\n/g, '\n').split('\n').forEach(function (line) {
      var m = line.match(/^##\s+(.*\S)\s*$/);
      if (m) {
        if (cur) out.push(cur);
        cur = { title: m[1], lines: [] };
      } else if (cur) {
        cur.lines.push(line);
      }
    });
    if (cur) out.push(cur);
    return out.map(function (p) {
      var text = p.lines.join('\n').trim();
      var fence = text.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
      if (fence) text = fence[1].trim();
      return { title: p.title, text: text };
    });
  }

  // enlaces.md: "## Categoría" y líneas "- [Título](https://...) descripción"
  function parseLinks(md) {
    var groups = [], cur = { name: '', items: [] };
    function safe(u) { return /^https?:\/\//i.test(u); }
    md.replace(/\r\n/g, '\n').split('\n').forEach(function (line) {
      var g = line.match(/^##\s+(.*\S)\s*$/);
      if (g) {
        if (cur.items.length) groups.push(cur);
        cur = { name: g[1], items: [] };
        return;
      }
      var a = line.match(/^\s*[-*]\s*\[([^\]]+)\]\(([^)\s]+)\)\s*[—–:-]?\s*(.*)$/);
      if (a && safe(a[2])) { cur.items.push({ title: a[1], url: a[2], desc: a[3].trim() }); return; }
      var b = line.match(/^\s*[-*]\s*(https?:\/\/\S+)\s*(.*)$/i);
      if (b) cur.items.push({ title: b[1].replace(/^https?:\/\//i, ''), url: b[1], desc: b[2].trim() });
    });
    if (cur.items.length) groups.push(cur);
    return groups;
  }

  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /* ============ Carpetas en el manifiesto ============ */

  // "Mates/Tema 1/a.pdf" -> { folders: { Mates: ["Tema 1/a.pdf"] }, loose: [...] }
  function groupFolders(list) {
    var folders = {}, loose = [];
    list.forEach(function (p) {
      var i = p.indexOf('/');
      if (i < 0) loose.push(p);
      else (folders[p.slice(0, i)] = folders[p.slice(0, i)] || []).push(p.slice(i + 1));
    });
    return { folders: folders, loose: loose };
  }

  // Agrupa rutas por subcarpeta: { "": [...], "Tema 1": [...] }
  function groupByDir(list) {
    var g = {};
    list.forEach(function (p) {
      var i = p.lastIndexOf('/');
      var dir = i < 0 ? '' : p.slice(0, i);
      (g[dir] = g[dir] || []).push(p);
    });
    return g;
  }

  function fileRow(sectionId, path) {
    return h('a', { class: 'file item', href: ROOT + encodePath(sectionId + '/' + path),
                    target: '_blank', rel: 'noopener', 'data-search': fileTitle(path).toLowerCase() },
      h('span', { class: 'file-name', text: fileTitle(path) }),
      fileExt(path) ? h('span', { class: 'tag', text: fileExt(path) }) : null);
  }

  function fileGroups(sectionId, prefix, paths, headingTag) {
    var wrap = h('div');
    var g = groupByDir(paths);
    Object.keys(g).sort(function (a, b) {
      if (a === '') return -1; if (b === '') return 1; return cmp(a, b);
    }).forEach(function (dir) {
      var files = g[dir].slice().sort(function (a, b) { return cmp(baseName(a), baseName(b)); });
      var rows = h('div', { class: 'rows' });
      files.forEach(function (p) { rows.appendChild(fileRow(sectionId, prefix + p)); });
      var box = h('div', { class: 'group' });
      if (dir) box.appendChild(h(headingTag || 'h2', { text: nice(dir.split('/').join(' / ')) }));
      box.appendChild(rows);
      wrap.appendChild(box);
    });
    return wrap;
  }

  /* ============ Buscador ============ */

  function addSearch(main, container, placeholder) {
    var input = h('input', { class: 'search', type: 'search', placeholder: placeholder,
                             'aria-label': placeholder, autocomplete: 'off' });
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      container.querySelectorAll('.item').forEach(function (it) {
        var ok = !q || (it.getAttribute('data-search') || '').indexOf(q) !== -1;
        it.classList.toggle('hidden', !ok);
      });
      container.querySelectorAll('.group').forEach(function (g) {
        g.classList.toggle('hidden', !g.querySelector('.item:not(.hidden)'));
      });
    });
    main.insertBefore(input, container);
  }

  /* ============ Copiar ============ */

  function copyText(text, btn) {
    function done() {
      btn.textContent = 'Copiado';
      btn.classList.add('ok');
      setTimeout(function () { btn.textContent = 'Copiar'; btn.classList.remove('ok'); }, 1600);
    }
    function fallback() {
      var ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0;top:0;left:0' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* sin permiso */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  /* ============ Páginas ============ */

  function renderHome(main) {
    main.appendChild(h('h1', { text: 'Segundo cerebro' }));
    main.appendChild(h('p', { class: 'lead', text: 'Mi material de trabajo, en un solo sitio.' }));
    var rows = h('div', { class: 'rows' });
    main.appendChild(rows);

    Promise.all([
      getManifest().catch(function () { return null; }),
      optionalText('prompts/prompts.md'),
      optionalText('recursos/enlaces.md')
    ]).then(function (res) {
      var m = res[0] || {};
      var nPrompts = parsePrompts(res[1]).length;
      var nLinks = parseLinks(res[2]).reduce(function (n, g) { return n + g.items.length; }, 0);

      SECTIONS.forEach(function (s) {
        var count = '';
        if (s.kind === 'folders') {
          var d = groupFolders(m[s.id] || []);
          count = plural(Object.keys(d.folders).length, s.noun, s.nouns);
        } else if (s.kind === 'recursos') {
          var files = (m.recursos || []).length;
          count = plural(nLinks, 'enlace', 'enlaces') + ' y ' + plural(files, 'archivo', 'archivos');
        } else if (s.kind === 'prompts') {
          count = plural(nPrompts, 'prompt', 'prompts');
        }
        rows.appendChild(h('a', { class: 'row', href: s.id + '/' },
          h('div', null, h('span', { class: 't', text: s.name }), h('span', { class: 'd', text: s.desc })),
          h('span', { class: 'n', text: count })));
      });
    });
  }

  function renderFolders(main, s) {
    function draw() {
      main.textContent = '';
      getManifest().then(function (m) {
        var data = groupFolders(m[s.id] || []);
        var names = Object.keys(data.folders).sort(cmp);
        var chosen = '';
        try { chosen = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { chosen = ''; }

        if (chosen && data.folders[chosen]) {
          var files = data.folders[chosen];
          main.appendChild(h('a', { class: 'back', href: '#', text: '← ' + s.back }));
          main.appendChild(h('h1', { text: nice(chosen) }));
          main.appendChild(h('p', { class: 'lead', text: plural(files.length, 'archivo', 'archivos') }));
          main.appendChild(fileGroups(s.id, chosen + '/', files));
          window.scrollTo(0, 0);
          return;
        }

        main.appendChild(h('h1', { text: s.name }));
        main.appendChild(h('p', { class: 'lead', text: s.desc }));

        if (!names.length && !data.loose.length) {
          main.appendChild(emptyNote('Todavía no hay nada. Crea una carpeta y sube tus archivos dentro de', s.id + '/'));
          return;
        }

        var rows = h('div', { class: 'rows' });
        names.forEach(function (n) {
          rows.appendChild(h('a', { class: 'row', href: '#' + encodeURIComponent(n) },
            h('div', null, h('span', { class: 't', text: nice(n) })),
            h('span', { class: 'n', text: plural(data.folders[n].length, 'archivo', 'archivos') })));
        });
        if (names.length) main.appendChild(rows);

        if (data.loose.length) {
          main.appendChild(h('h2', { text: 'Archivos sueltos' }));
          main.appendChild(fileGroups(s.id, '', data.loose));
        }
      }).catch(function () { main.textContent = ''; main.appendChild(h('h1', { text: s.name })); errorNote(main); });
    }
    window.addEventListener('hashchange', draw);
    draw();
  }

  function renderPrompts(main, s) {
    main.appendChild(h('h1', { text: s.name }));
    getText('prompts/prompts.md').then(function (md) {
      var list = parsePrompts(md);
      main.appendChild(h('p', { class: 'lead', text: s.desc }));
      if (!list.length) {
        main.appendChild(emptyNote('Todavía no hay prompts. Escríbelos en el archivo', 'prompts/prompts.md'));
        return;
      }
      var box = h('div', { class: 'rows' });
      list.forEach(function (p) {
        var btn = h('button', { class: 'btn', type: 'button', text: 'Copiar' });
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          copyText(p.text, btn);
        });
        var excerpt = p.text.replace(/\s+/g, ' ').slice(0, 140);
        var det = h('details', { class: 'prompt item', 'data-search': (p.title + ' ' + p.text).toLowerCase() },
          h('summary', null,
            h('span', { class: 'p-main' },
              h('span', { class: 'p-title', text: p.title }),
              h('span', { class: 'p-excerpt', text: excerpt })),
            btn),
          h('pre', { class: 'p-text', text: p.text }));
        box.appendChild(det);
      });
      main.appendChild(box);
      addSearch(main, box, 'Buscar un prompt');
    }).catch(function () { main.appendChild(h('p', { class: 'lead', text: s.desc })); errorNote(main); });
  }

  function renderRecursos(main, s) {
    main.appendChild(h('h1', { text: s.name }));
    main.appendChild(h('p', { class: 'lead', text: s.desc }));
    Promise.all([getManifest(), optionalText('recursos/enlaces.md')]).then(function (res) {
      var files = res[0].recursos || [];
      var groups = parseLinks(res[1]);
      var box = h('div');

      if (!groups.length && !files.length) {
        main.appendChild(emptyNote('Todavía no hay nada. Añade enlaces en', 'recursos/enlaces.md'));
        main.appendChild(h('p', { class: 'lead' }, 'Los PDF y otros archivos se suben dentro de la carpeta ', h('code', { text: 'recursos/' }), '.'));
        return;
      }

      if (groups.length) {
        box.appendChild(h('h2', { text: 'Enlaces' }));
        groups.forEach(function (g) {
          var wrap = h('div', { class: 'group' });
          if (g.name) wrap.appendChild(h('h2', { text: g.name }));
          var rows = h('div', { class: 'rows' });
          g.items.forEach(function (it) {
            rows.appendChild(h('a', { class: 'link-row item', href: it.url, target: '_blank', rel: 'noopener noreferrer',
                                      'data-search': (it.title + ' ' + it.desc + ' ' + g.name).toLowerCase() },
              h('span', null, h('span', { class: 'link-name', text: it.title }),
                it.desc ? h('span', { class: 'd', text: it.desc }) : null),
              h('span', { class: 'host', text: host(it.url) })));
          });
          wrap.appendChild(rows);
          box.appendChild(wrap);
        });
      }

      if (files.length) {
        box.appendChild(h('h2', { text: 'Archivos' }));
        box.appendChild(fileGroups(s.id, '', files, 'h2'));
      }

      main.appendChild(box);
      addSearch(main, box, 'Buscar un recurso');
    }).catch(function () { errorNote(main); });
  }

  function renderPage(main) {
    if (PAGE === 'home') return renderHome(main);
    var s = SECTIONS.filter(function (x) { return x.id === PAGE; })[0];
    if (!s) return;
    if (s.kind === 'folders') renderFolders(main, s);
    else if (s.kind === 'prompts') renderPrompts(main, s);
    else if (s.kind === 'recursos') renderRecursos(main, s);
  }

  /* ============ Estructura común ============ */

  function buildShell() {
    var shell = document.getElementById('shell');
    var nav = h('nav', { 'aria-label': 'Secciones' });
    SECTIONS.forEach(function (s) {
      nav.appendChild(h('a', { href: ROOT + s.id + '/', text: s.name,
                               'aria-current': PAGE === s.id ? 'page' : null }));
    });
    var side = h('header', { class: 'side' },
      h('a', { class: 'brand', href: ROOT || './', text: 'Segundo cerebro' }),
      nav,
      h('button', { class: 'link-btn', type: 'button', text: 'Salir', onclick: logout }));
    var main = h('main', { id: 'main' });
    shell.appendChild(side);
    shell.appendChild(main);
    return main;
  }

  /* ============ Contraseña ============ */

  function getStored() { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } }
  function setStored(v) {
    try { if (v) localStorage.setItem(STORE_KEY, v); else localStorage.removeItem(STORE_KEY); } catch (e) { /* sin almacenamiento */ }
  }

  function logout() { setStored(null); location.reload(); }

  function derive(pw) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITER, hash: 'SHA-256' }, key, 256);
      })
      .then(function (bits) {
        return Array.prototype.map.call(new Uint8Array(bits), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
  }

  function unlock(start) {
    document.documentElement.classList.remove('locked');
    start();
  }

  function showGate(start) {
    var input = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: '' });
    var err = h('p', { class: 'gate-err', role: 'alert' });
    var gate = h('div', { class: 'gate' });
    var form = h('form', { class: 'gate-box' },
      h('p', { class: 'brand', text: 'Segundo cerebro' }),
      h('label', { for: 'pw', text: 'Contraseña' }),
      input,
      h('button', { class: 'btn btn-fill', type: 'submit', text: 'Entrar' }),
      err);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      if (!(window.crypto && crypto.subtle)) {
        err.textContent = 'Este navegador no puede comprobar la contraseña en esta conexión. Abre la web con https.';
        return;
      }
      derive(input.value).then(function (d) {
        if (d === HASH) {
          setStored(d);
          document.body.removeChild(gate);
          unlock(start);
        } else {
          err.textContent = 'Contraseña incorrecta.';
          input.select();
        }
      });
    });
    gate.appendChild(form);
    document.body.appendChild(gate);
    input.focus();
  }

  /* ============ Arranque ============ */

  var main = buildShell();
  function init() { renderPage(main); }
  if (getStored() === HASH) unlock(init);
  else showGate(init);
})();
