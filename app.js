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
    { id: 'diapositivas', name: 'Diapositivas', icon: 'slides', desc: 'Presentaciones, ordenadas por asignatura.',
      kind: 'folders', noun: 'asignatura', nouns: 'asignaturas' },
    { id: 'organizacion', name: 'Organización', icon: 'clipboard', desc: 'Reuniones, tareas, objetivos y procesos.',
      kind: 'folders', noun: 'carpeta', nouns: 'carpetas' },
    { id: 'recursos', name: 'Recursos', icon: 'bookmark', desc: 'Enlaces, PDF y material que me sirve.', kind: 'recursos' },
    { id: 'prompts', name: 'Prompts', icon: 'chat', desc: 'Los que uso siempre, listos para copiar.', kind: 'prompts' }
  ];

  /* ============ Iconos ============ */

  var ICONS = {
    slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="M5 12l5 5 10-10"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9"/>',
    spark: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    inbox: '<path d="M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5"/>'
  };

  function icon(name, size) {
    var s = document.createElement('span');
    s.className = 'ico';
    var n = size || 20;
    s.innerHTML = '<svg viewBox="0 0 24 24" width="' + n + '" height="' + n + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
    return s;
  }

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
    return m ? m[1].toLowerCase() : '';
  }

  function fileKind(ext) {
    if (ext === 'pdf') return { cls: 'pdf', label: 'Documento PDF' };
    if (/^(ppt|pptx|pps|ppsx|key|odp)$/.test(ext)) return { cls: 'ppt', label: 'Presentación' };
    if (/^(doc|docx|odt|rtf)$/.test(ext)) return { cls: 'doc', label: 'Documento' };
    if (/^(xls|xlsx|csv|ods)$/.test(ext)) return { cls: 'xls', label: 'Hoja de cálculo' };
    if (/^(png|jpg|jpeg|gif|webp|svg)$/.test(ext)) return { cls: 'img', label: 'Imagen' };
    if (/^(mp4|mov|webm|mkv)$/.test(ext)) return { cls: 'vid', label: 'Vídeo' };
    if (/^(zip|rar|7z)$/.test(ext)) return { cls: 'zip', label: 'Archivo comprimido' };
    if (/^(txt|md)$/.test(ext)) return { cls: 'other', label: 'Texto' };
    return { cls: 'other', label: 'Archivo' };
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
    }).then(function (m) { PREVIEWS = m._previews || {}; return m; });
  }

  function optionalText(path) { return getText(path).catch(function () { return ''; }); }

  function sectionById(id) { return SECTIONS.filter(function (s) { return s.id === id; })[0]; }

  function pageHead(main, title, lead) {
    main.appendChild(h('h1', { text: title }));
    if (lead) main.appendChild(h('p', { class: 'lead', text: lead }));
  }

  function errorNote(main) {
    main.appendChild(h('div', { class: 'empty' },
      h('span', { class: 'tile' }, icon('inbox', 22)),
      h('p', { text: 'No se pudo cargar el contenido. Esta página funciona una vez publicada en GitHub Pages; ' +
                     'si la abres directamente desde tu ordenador, no puede leer las carpetas.' })));
  }

  function emptyNote(text, code, extra) {
    var box = h('div', { class: 'empty' },
      h('span', { class: 'tile' }, icon('inbox', 22)),
      h('p', null, text + ' ', h('code', { text: code }), '.'));
    if (extra) {
      var p = h('p');
      extra.forEach(function (c) { p.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      box.appendChild(p);
    }
    return box;
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

  function groupFolders(list) {
    var folders = {}, loose = [];
    list.forEach(function (p) {
      var i = p.indexOf('/');
      if (i < 0) loose.push(p);
      else (folders[p.slice(0, i)] = folders[p.slice(0, i)] || []).push(p.slice(i + 1));
    });
    return { folders: folders, loose: loose };
  }

  function groupByDir(list) {
    var g = {};
    list.forEach(function (p) {
      var i = p.lastIndexOf('/');
      var dir = i < 0 ? '' : p.slice(0, i);
      (g[dir] = g[dir] || []).push(p);
    });
    return g;
  }

  /* ============ Vista previa ============ */

  var PREVIEWS = {};          // ruta original -> PDF generado al publicar
  var IMG_RE = /^(png|jpg|jpeg|gif|webp|svg)$/;
  var VID_RE = /^(mp4|webm|mov)$/;
  var TXT_RE = /^(txt|md|csv|json)$/;

  function previewKind(url, ext, key) {
    if (ext === 'pdf') return { type: 'pdf', src: url };
    if (PREVIEWS[key]) return { type: 'pdf', src: ROOT + encodePath(PREVIEWS[key]) };
    if (IMG_RE.test(ext)) return { type: 'img', src: url };
    if (VID_RE.test(ext)) return { type: 'video', src: url };
    if (TXT_RE.test(ext)) return { type: 'text', src: url };
    return null;
  }

  var modal = null;

  function closePreview() {
    if (!modal) return;
    document.body.classList.remove('modal-open');
    modal.remove();
    modal = null;
    document.removeEventListener('keydown', onModalKey);
  }

  function onModalKey(e) { if (e.key === 'Escape') closePreview(); }

  function openPreview(sectionId, path) {
    closePreview();
    var key = sectionId + '/' + path;
    var url = ROOT + encodePath(key);
    var ext = fileExt(path);
    var pv = previewKind(url, ext, key);
    var body = h('div', { class: 'pv-body' });

    if (pv && pv.type === 'pdf') {
      body.appendChild(h('iframe', { class: 'pv-frame', src: pv.src + '#view=FitH', title: fileTitle(path) }));
    } else if (pv && pv.type === 'img') {
      body.appendChild(h('img', { class: 'pv-img', src: pv.src, alt: fileTitle(path) }));
    } else if (pv && pv.type === 'video') {
      body.appendChild(h('video', { class: 'pv-video', src: pv.src, controls: 'controls' }));
    } else if (pv && pv.type === 'text') {
      var pre = h('pre', { class: 'pv-text', text: 'Cargando…' });
      body.appendChild(pre);
      getText(key).then(function (t) { pre.textContent = t; }, function () { pre.textContent = 'No se pudo cargar el archivo.'; });
    } else {
      body.appendChild(h('div', { class: 'empty pv-none' },
        h('span', { class: 'tile' }, icon('inbox', 22)),
        h('p', { text: 'Este tipo de archivo no tiene vista previa. Puedes descargarlo para abrirlo.' })));
    }

    var bar = h('div', { class: 'pv-bar' },
      h('span', { class: 'pv-title', text: fileTitle(path) }),
      h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, icon('external', 16), 'Abrir'),
      h('a', { class: 'btn', href: url, download: baseName(path) }, icon('download', 16), 'Descargar'),
      h('button', { class: 'btn primary', type: 'button', 'aria-label': 'Cerrar', onclick: closePreview }, icon('close', 16), 'Cerrar'));

    modal = h('div', { class: 'pv-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': fileTitle(path) },
      h('div', { class: 'pv-box' }, bar, body));
    modal.addEventListener('click', function (e) { if (e.target === modal) closePreview(); });
    document.addEventListener('keydown', onModalKey);
    document.body.classList.add('modal-open');
    document.body.appendChild(modal);
  }

  // Cada asignatura tiene un color según su nombre; si dos coinciden, la segunda pasa
  // al siguiente color libre (mientras haya menos de 10 asignaturas no se repite ninguno).
  var SUBJ_COLORS = 10;
  var subjMap = {};
  function nameHash(name) {
    var hsh = 0, n = name.normalize('NFC').trim().toLowerCase();
    for (var i = 0; i < n.length; i++) hsh = (hsh * 31 + n.charCodeAt(i)) >>> 0;
    return hsh;
  }
  function assignSubjColors(names) {
    var used = {}, count = 0;
    subjMap = {};
    names.slice().sort(cmp).forEach(function (n) {
      var slot = nameHash(n) % SUBJ_COLORS;
      if (count < SUBJ_COLORS) { while (used[slot]) slot = (slot + 1) % SUBJ_COLORS; used[slot] = true; count++; }
      subjMap[n] = slot;
    });
  }
  function subjClass(name) {
    return 'subj-' + (name in subjMap ? subjMap[name] : nameHash(name) % SUBJ_COLORS);
  }

  function fileCard(sectionId, path) {
    var ext = fileExt(path), k = fileKind(ext);
    var card = h('a', { class: 'card file-card item', href: ROOT + encodePath(sectionId + '/' + path),
                    target: '_blank', rel: 'noopener', 'data-search': fileTitle(path).toLowerCase() },
      h('span', { class: 'ft ft-' + k.cls, text: (ext || 'file').toUpperCase().slice(0, 4) }),
      h('span', { class: 'file-info' },
        h('span', { class: 'file-name', text: fileTitle(path) }),
        h('span', { class: 'file-sub', text: k.label })),
      h('span', { class: 'ext-ico' }, icon('search', 18)));
    // Clic normal: vista previa. Ctrl/Cmd/clic central: abre el archivo en otra pestaña.
    card.addEventListener('click', function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openPreview(sectionId, path);
    });
    return card;
  }

  function fileGroups(sectionId, prefix, paths) {
    var wrap = h('div');
    var g = groupByDir(paths);
    Object.keys(g).sort(function (a, b) {
      if (a === '') return -1;
      if (b === '') return 1;
      return cmp(a, b);
    }).forEach(function (dir) {
      var files = g[dir].slice().sort(function (a, b) { return cmp(baseName(a), baseName(b)); });
      var grid = h('div', { class: 'grid files' });
      files.forEach(function (p) { grid.appendChild(fileCard(sectionId, prefix + p)); });
      var box = h('div', { class: 'group' });
      if (dir) {
        box.appendChild(h('div', { class: 'sec-title' },
          icon('folder', 18), nice(dir.split('/').join(' / ')),
          h('span', { class: 'count', text: String(files.length) })));
      }
      box.appendChild(grid);
      wrap.appendChild(box);
    });
    return wrap;
  }

  /* ============ Buscador ============ */

  function addSearch(main, container, placeholder) {
    var input = h('input', { class: 'search', type: 'search', placeholder: placeholder,
                             'aria-label': placeholder, autocomplete: 'off' });
    var none = h('div', { class: 'empty hidden' }, h('p', { text: 'No hay resultados para esa búsqueda.' }));
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      container.querySelectorAll('.item').forEach(function (it) {
        var ok = !q || (it.getAttribute('data-search') || '').indexOf(q) !== -1;
        it.classList.toggle('hidden', !ok);
      });
      container.querySelectorAll('.group').forEach(function (g) {
        g.classList.toggle('hidden', !g.querySelector('.item:not(.hidden)'));
      });
      none.classList.toggle('hidden', !!container.querySelector('.item:not(.hidden)'));
    });
    main.insertBefore(h('div', { class: 'searchbox' }, icon('search', 18), input), container);
    main.appendChild(none);
  }

  /* ============ Copiar ============ */

  function copyText(text, btn, label) {
    function done() {
      label.textContent = 'Copiado';
      btn.classList.add('done');
      setTimeout(function () { label.textContent = 'Copiar'; btn.classList.remove('done'); }, 1600);
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
    pageHead(main, 'Segundo cerebro', 'Mi material de trabajo, en un solo sitio.');
    var grid = h('div', { class: 'grid big' });
    main.appendChild(grid);

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
          count = plural(Object.keys(groupFolders(m[s.id] || []).folders).length, s.noun, s.nouns);
        } else if (s.kind === 'recursos') {
          count = plural(nLinks + (m.recursos || []).length, 'elemento', 'elementos');
        } else if (s.kind === 'prompts') {
          count = plural(nPrompts, 'prompt', 'prompts');
        }
        grid.appendChild(h('a', { class: 'card home-card c-' + s.id, href: s.id + '/' },
          h('span', { class: 'tile' }, icon(s.icon, 24)),
          h('div', null,
            h('span', { class: 'card-title', text: s.name }),
            h('span', { class: 'card-desc', text: s.desc })),
          h('div', { class: 'card-foot' },
            h('span', { class: 'pill', text: count }),
            h('span', { class: 'go' }, icon('arrow', 20)))));
      });
    });
  }

  function renderFolders(main, s) {
    function draw() {
      main.textContent = '';
      getManifest().then(function (m) {
        var data = groupFolders(m[s.id] || []);
        var names = Object.keys(data.folders).sort(cmp);
        assignSubjColors(names);
        var chosen = '';
        try { chosen = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { chosen = ''; }

        if (chosen && data.folders[chosen]) {
          var files = data.folders[chosen];
          main.appendChild(h('div', { class: 'crumbs' },
            h('a', { class: 'back', href: '#' }, icon('back', 16), s.name)));
          pageHead(main, nice(chosen), plural(files.length, 'archivo', 'archivos'));
          var detail = fileGroups(s.id, chosen + '/', files);
          if (s.id === 'diapositivas') detail.classList.add(subjClass(chosen));
          main.appendChild(detail);
          window.scrollTo(0, 0);
          return;
        }

        pageHead(main, s.name, s.desc);

        if (!names.length && !data.loose.length) {
          main.appendChild(emptyNote('Todavía no hay nada. Crea una carpeta y sube tus archivos dentro de', s.id + '/'));
          return;
        }

        if (names.length) {
          var grid = h('div', { class: 'grid' });
          names.forEach(function (n) {
            grid.appendChild(h('a', { class: 'card c-' + s.id + (s.id === 'diapositivas' ? ' ' + subjClass(n) : ''), href: '#' + encodeURIComponent(n) },
              h('span', { class: 'tile' }, icon('folder', 24)),
              h('span', { class: 'card-title', text: nice(n) }),
              h('div', { class: 'card-foot' },
                h('span', { class: 'pill', text: plural(data.folders[n].length, 'archivo', 'archivos') }),
                h('span', { class: 'go' }, icon('arrow', 20)))));
          });
          main.appendChild(grid);
        }

        if (data.loose.length) {
          main.appendChild(h('div', { class: 'sec-title' }, 'Archivos sueltos',
            h('span', { class: 'count', text: String(data.loose.length) })));
          main.appendChild(fileGroups(s.id, '', data.loose));
        }
      }).catch(function () { main.textContent = ''; pageHead(main, s.name, s.desc); errorNote(main); });
    }
    window.addEventListener('hashchange', draw);
    draw();
  }

  function renderPrompts(main, s) {
    getText('prompts/prompts.md').then(function (md) {
      var list = parsePrompts(md);
      pageHead(main, s.name, list.length ? plural(list.length, 'prompt', 'prompts') + '. ' + 'Copia el que necesites con un clic.' : s.desc);
      if (!list.length) {
        main.appendChild(emptyNote('Todavía no hay prompts. Escríbelos en el archivo', 'prompts/prompts.md'));
        return;
      }
      var grid = h('div', { class: 'grid prompts' });
      var overflowChecks = [];
      list.forEach(function (p) {
        var label = h('span', { text: 'Copiar' });
        var copyBtn = h('button', { class: 'btn primary', type: 'button' }, icon('copy', 16), label);
        copyBtn.addEventListener('click', function () { copyText(p.text, copyBtn, label); });

        var card = h('article', { class: 'card prompt-card item c-prompts',
                                  'data-search': (p.title + ' ' + p.text).toLowerCase() });
        var actions = h('div', { class: 'p-actions' }, copyBtn);
        var more = h('button', { class: 'btn ghost', type: 'button', text: 'Ver completo' });
        more.addEventListener('click', function () {
          var open = card.classList.toggle('open');
          more.textContent = open ? 'Ver menos' : 'Ver completo';
        });
        actions.appendChild(more);
        var body = h('p', { class: 'p-body', text: p.text });
        card.appendChild(h('span', { class: 'tile' }, icon('chat', 22)));
        card.appendChild(h('span', { class: 'card-title', text: p.title }));
        card.appendChild(body);
        card.appendChild(actions);
        grid.appendChild(card);
        // El botón solo se muestra si el texto no cabe en la tarjeta cerrada
        overflowChecks.push(function () {
          if (card.classList.contains('open')) return;
          more.classList.toggle('hidden', body.scrollHeight <= body.clientHeight + 1);
        });
      });
      main.appendChild(grid);
      function runChecks() { overflowChecks.forEach(function (f) { f(); }); }
      runChecks();
      window.addEventListener('resize', runChecks);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(runChecks);
      addSearch(main, grid, 'Buscar un prompt');
    }).catch(function () { pageHead(main, s.name, s.desc); errorNote(main); });
  }

  function renderRecursos(main, s) {
    pageHead(main, s.name, s.desc);
    Promise.all([getManifest(), optionalText('recursos/enlaces.md')]).then(function (res) {
      var files = res[0].recursos || [];
      var groups = parseLinks(res[1]);
      var box = h('div');

      if (!groups.length && !files.length) {
        main.appendChild(emptyNote('Todavía no hay nada. Añade enlaces en', 'recursos/enlaces.md',
          ['Los PDF y otros archivos se suben dentro de la carpeta ', h('code', { text: 'recursos/' }), '.']));
        return;
      }

      groups.forEach(function (g) {
        var wrap = h('div', { class: 'group' });
        wrap.appendChild(h('div', { class: 'sec-title' }, icon('link', 18), g.name || 'Enlaces',
          h('span', { class: 'count', text: String(g.items.length) })));
        var grid = h('div', { class: 'grid' });
        g.items.forEach(function (it) {
          grid.appendChild(h('a', { class: 'card link-card c-recursos item', href: it.url, target: '_blank',
                                    rel: 'noopener noreferrer',
                                    'data-search': (it.title + ' ' + it.desc + ' ' + g.name).toLowerCase() },
            h('span', { class: 'tile' }, icon('link', 22)),
            h('div', null,
              h('span', { class: 'card-title', text: it.title }),
              it.desc ? h('span', { class: 'card-desc line-clamp', text: it.desc }) : null),
            h('div', { class: 'card-foot' },
              h('span', { class: 'host', text: host(it.url) }),
              h('span', { class: 'go' }, icon('external', 18)))));
        });
        wrap.appendChild(grid);
        box.appendChild(wrap);
      });

      if (files.length) {
        box.appendChild(h('div', { class: 'sec-title' }, icon('bookmark', 18), 'Archivos',
          h('span', { class: 'count', text: String(files.length) })));
        box.appendChild(fileGroups(s.id, '', files));
      }

      main.appendChild(box);
      addSearch(main, box, 'Buscar un recurso');
    }).catch(function () { errorNote(main); });
  }

  function renderPage(main) {
    if (PAGE === 'home') return renderHome(main);
    var s = sectionById(PAGE);
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
      nav.appendChild(h('a', { class: 'c-' + s.id, href: ROOT + s.id + '/',
                               'aria-current': PAGE === s.id ? 'page' : null },
        icon(s.icon, 20), s.name));
    });
    var side = h('header', { class: 'side' },
      h('a', { class: 'brand', href: ROOT || './' },
        h('span', { class: 'brand-mark' }, icon('spark', 20)), 'Segundo cerebro'),
      nav,
      h('button', { class: 'logout', type: 'button', onclick: logout, 'aria-label': 'Salir' },
        icon('logout', 18), h('span', { class: 'label', text: 'Salir' })));
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
      h('span', { class: 'brand-mark' }, icon('spark', 24)),
      h('h1', { text: 'Segundo cerebro' }),
      h('p', { class: 'sub', text: 'Introduce la contraseña para entrar.' }),
      h('label', { for: 'pw', text: 'Contraseña' }),
      input,
      h('button', { class: 'btn primary', type: 'submit', text: 'Entrar' }),
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
