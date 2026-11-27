/* Panel de administración.
   Habla directamente con la API de GitHub desde el navegador (sin servidores
   intermedios), así que no hay límite de 4,5 MB por subida. Reduce cada foto a
   2000 px antes de enviarla y publica todos los cambios en un único commit. */
(function () {
  "use strict";

  var API = "https://api.github.com";
  var MAX_SIDE = 2000, HERO_SIDE = 2400, QUALITY = 0.85;
  var STORE = "fotos-admin";

  var cfg = { repo: "", token: "", branch: "main" };
  var loaded = { gSha: "", sSha: "", paths: {} };
  var site = {}, galleries = [], sel = -1, uid = 0, dirty = false, hero = null, tab = "galleries";
  var thumbs = {}; // ruta publicada -> miniatura local (la web tarda 1-2 min en servirla)

  function $(id) { return document.getElementById(id); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === "text") el.textContent = v;
      else if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function slug(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "foto";
  }
  function rand(n) { return Math.random().toString(36).slice(2, 2 + n).padEnd(n, "0"); }
  function utf8(b64) {
    var bin = atob(b64.replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function toB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = function () { rej(new Error("No se pudo leer una foto.")); };
      r.readAsDataURL(blob);
    });
  }

  /* ---------- avisos ---------- */
  var toastTimer;
  function toast(msg, isErr) {
    var t = $("toast");
    t.textContent = msg; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isErr ? 9000 : 6000);
  }
  function busy(msg) { $("busy-text").textContent = msg; $("busy").hidden = false; }
  function unbusy() { $("busy").hidden = true; }
  function markDirty() { dirty = true; $("dirtybar").hidden = false; }
  function clearDirty() { dirty = false; $("dirtybar").hidden = true; }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- GitHub ---------- */
  function gh(method, path, body) {
    var opts = { method: method, headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json" } };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch(API + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { /* respuesta sin JSON */ }
        if (!r.ok) { var err = new Error((j && j.message) || ("Error " + r.status)); err.status = r.status; throw err; }
        return j;
      });
    }, function () { throw new Error("No hay conexión con GitHub. Revisa internet."); });
  }
  function friendly(e) {
    if (e.status === 401) return "La clave no es válida o ha caducado. Crea una nueva.";
    if (e.status === 403) return "GitHub no deja hacer esto con esa clave (revisa que tenga permiso «Contents: Read and write»). " + e.message;
    if (e.status === 404) return "No encuentro ese repositorio, o la clave no tiene acceso a él.";
    return e.message || "Algo ha fallado.";
  }
  function getJSON(p) {
    return gh("GET", "/repos/" + cfg.repo + "/contents/" + p + "?ref=" + encodeURIComponent(cfg.branch)).then(function (r) {
      return { sha: r.sha, data: JSON.parse(utf8(r.content)) };
    });
  }

  async function loadData() {
    var g = await getJSON("content/galleries.json");
    var s = await getJSON("content/site.json");
    loaded.gSha = g.sha; loaded.sSha = s.sha;
    site = s.data || {};
    var list = Array.isArray(g.data) ? g.data : [];
    galleries = list.map(function (x) {
      return { k: ++uid, title: x.title || "", date: x.date || "", description: x.description || "",
        photos: (x.photos || []).map(function (p) { return { path: p }; }) };
    });
    loaded.paths = {};
    galleries.forEach(function (g) { g.photos.forEach(function (p) { loaded.paths[p.path] = 1; }); });
    if (site.heroImage) loaded.paths[site.heroImage] = 1;
    hero = null;
    sel = galleries.length ? Math.min(Math.max(sel, 0), galleries.length - 1) : -1;
    clearDirty();
  }

  /* ---------- reducir fotos ---------- */
  async function shrink(file, maxSide) {
    var bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) { bmp = await createImageBitmap(file); }
    var s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * s)), hh = Math.max(1, Math.round(bmp.height * s));
    var c = document.createElement("canvas"); c.width = w; c.height = hh;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, hh);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, hh);
    if (bmp.close) bmp.close();
    return new Promise(function (res, rej) {
      c.toBlob(function (b) { b ? res(b) : rej(new Error("No se pudo procesar la foto.")); }, "image/jpeg", QUALITY);
    });
  }
  function isImage(f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(f.name); }

  async function addFiles(g, files) {
    var arr = Array.prototype.filter.call(files, isImage), bad = [], n = 0;
    if (!arr.length) { toast("No he encontrado fotos en lo que has soltado.", true); return; }
    for (var i = 0; i < arr.length; i++) {
      n++; busy("Preparando fotos… " + n + " de " + arr.length);
      try {
        var b = await shrink(arr[i], MAX_SIDE);
        g.photos.push({ blob: b, url: URL.createObjectURL(b), name: arr[i].name });
      } catch (e) { bad.push(arr[i].name); }
    }
    unbusy(); markDirty(); renderEditor(); renderList();
    if (bad.length) toast("No he podido leer: " + bad.join(", ") + ". (Las fotos HEIC de iPhone conviene exportarlas a JPG.)", true);
  }

  /* ---------- vistas ---------- */
  function src(p) {
    if (p.url) return p.url;
    return thumbs[p.path] || ("../" + String(p.path).replace(/^\/+/, ""));
  }

  function renderList() {
    var box = $("gallery-list"); box.textContent = "";
    if (!galleries.length) { box.appendChild(h("p", { class: "hint", text: "Aún no hay galerías." })); return; }
    galleries.forEach(function (g, i) {
      box.appendChild(h("button", { class: "g-item" + (i === sel ? " active" : ""), type: "button",
        onclick: function () { sel = i; renderList(); renderEditor(); } }, [
        h("span", { text: g.title || "(sin título)" }),
        h("small", { text: g.photos.length + (g.photos.length === 1 ? " foto" : " fotos") })
      ]));
    });
  }

  function renderEditor() {
    var box = $("editor"); box.textContent = "";
    var g = galleries[sel];
    if (!g) { box.appendChild(h("p", { class: "empty", text: "Crea una galería para empezar." })); return; }

    var title = h("input", { type: "text", id: "g-title", value: g.title, placeholder: "Ej. Lunes Santo",
      oninput: function () { g.title = this.value; markDirty(); renderList(); } });
    var date = h("input", { type: "date", id: "g-date", value: g.date,
      onchange: function () { g.date = this.value; markDirty(); } });
    var desc = h("textarea", { id: "g-desc", placeholder: "Opcional",
      oninput: function () { g.description = this.value; markDirty(); } });
    desc.value = g.description;

    box.appendChild(h("div", { class: "row2" }, [
      h("div", {}, [h("label", { for: "g-title", text: "Título de la galería" }), title]),
      h("div", {}, [h("label", { for: "g-date", text: "Fecha" }), date])
    ]));
    box.appendChild(h("label", { for: "g-desc", text: "Descripción" }));
    box.appendChild(desc);

    var input = h("input", { type: "file", accept: "image/*", multiple: "multiple", hidden: "hidden",
      onchange: function () { addFiles(g, this.files); this.value = ""; } });
    var drop = h("div", { class: "drop", tabindex: "0", role: "button",
      onclick: function () { input.click(); },
      onkeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } },
      ondragover: function (e) { e.preventDefault(); drop.classList.add("over"); },
      ondragleave: function () { drop.classList.remove("over"); },
      ondrop: function (e) { e.preventDefault(); drop.classList.remove("over"); addFiles(g, e.dataTransfer.files); }
    }, [h("p", {}, [h("strong", { text: "Suelta aquí las fotos" }), " o pulsa para elegirlas"]),
        h("p", { class: "hint", text: "Pueden ser muchas a la vez y de cualquier tamaño: se reducen solas antes de subirlas." })]);
    box.appendChild(drop); box.appendChild(input);

    if (!g.photos.length) {
      box.appendChild(h("p", { class: "warn", text: "Una galería sin fotos no se muestra en la web." }));
    } else {
      box.appendChild(h("p", { class: "hint", text: "La primera foto es la portada de la galería. Pasa el ratón por encima de una foto para moverla o quitarla." }));
      var grid = h("div", { class: "grid" });
      g.photos.forEach(function (p, i) {
        var tools = h("div", { class: "tools" }, [
          h("button", { type: "button", title: "Mover antes", text: "◀", onclick: function () { move(g, i, -1); } }),
          i > 0 ? h("button", { type: "button", title: "Poner de portada", text: "★", onclick: function () { move(g, i, -i); } }) : null,
          h("button", { type: "button", title: "Mover después", text: "▶", onclick: function () { move(g, i, 1); } }),
          h("button", { type: "button", title: "Quitar", text: "✕", onclick: function () { g.photos.splice(i, 1); markDirty(); renderEditor(); renderList(); } })
        ]);
        grid.appendChild(h("div", { class: "tile" }, [
          h("img", { src: src(p), alt: "", loading: "lazy" }),
          p.blob ? h("span", { class: "badge", text: "NUEVA" }) : null,
          i === 0 ? h("span", { class: "badge cover", text: "PORTADA" }) : null,
          tools
        ]));
      });
      box.appendChild(grid);
    }

    box.appendChild(h("div", { class: "danger-zone" }, [
      h("button", { class: "btn danger", type: "button", text: "Eliminar esta galería",
        onclick: function () {
          if (!confirm("¿Eliminar la galería «" + (g.title || "sin título") + "» y sus fotos al publicar?")) return;
          galleries.splice(sel, 1); sel = galleries.length ? Math.max(0, sel - 1) : -1;
          markDirty(); renderList(); renderEditor();
        } })
    ]));
  }
  function move(g, i, d) {
    var j = i + d; if (j < 0 || j >= g.photos.length) return;
    var p = g.photos.splice(i, 1)[0]; g.photos.splice(j, 0, p);
    markDirty(); renderEditor();
  }

  var SITE_FIELDS = [
    ["name", "Nombre", "text"], ["tagline", "Frase bajo el nombre", "text"], ["about", "Presentación (opcional)", "area"],
    ["instagram", "Enlace de Instagram", "text"], ["facebook", "Enlace de Facebook (opcional)", "text"],
    ["email", "Correo (opcional)", "text"], ["phone", "Teléfono (opcional)", "text"], ["location", "Ciudad o zona (opcional)", "text"]
  ];
  function renderSite() {
    var box = $("view-site"); box.textContent = "";
    box.appendChild(h("h2", { text: "Foto de portada" }));
    box.appendChild(h("p", { class: "hint", text: "La que se ve nada más entrar en la web. Mejor horizontal." }));
    var cur = hero ? hero.url : (site.heroImage ? (thumbs[site.heroImage] || ("../" + String(site.heroImage).replace(/^\/+/, ""))) : "");
    if (cur) box.appendChild(h("img", { class: "hero-preview", src: cur, alt: "" }));
    var input = h("input", { type: "file", accept: "image/*", hidden: "hidden", onchange: async function () {
      var f = this.files[0]; this.value = ""; if (!f) return;
      busy("Preparando la foto…");
      try { var b = await shrink(f, HERO_SIDE); hero = { blob: b, url: URL.createObjectURL(b) }; markDirty(); renderSite(); }
      catch (e) { toast("No he podido leer esa foto.", true); }
      unbusy();
    } });
    box.appendChild(h("button", { class: "btn", type: "button", text: "Cambiar foto de portada", onclick: function () { input.click(); } }));
    box.appendChild(input);
    box.appendChild(h("h2", { text: "Datos" }));
    SITE_FIELDS.forEach(function (f) {
      var id = "s-" + f[0];
      var el = f[2] === "area" ? h("textarea", { id: id }) : h("input", { type: "text", id: id });
      el.value = site[f[0]] || "";
      el.addEventListener("input", function () { site[f[0]] = this.value; markDirty(); });
      box.appendChild(h("label", { for: id, text: f[1] })); box.appendChild(el);
    });
  }

  function setTab(t) {
    tab = t;
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) { b.classList.toggle("active", b.dataset.tab === t); });
    $("view-galleries").hidden = t !== "galleries";
    $("view-site").hidden = t !== "site";
    if (t === "site") renderSite();
  }

  /* ---------- publicar (un solo commit) ---------- */
  async function publish() {
    for (var i = 0; i < galleries.length; i++) {
      if (!galleries[i].title.trim()) { sel = i; renderList(); renderEditor(); setTab("galleries"); toast("Falta el título de una galería.", true); return; }
    }
    busy("Conectando con GitHub…");
    try {
      var ref = await gh("GET", "/repos/" + cfg.repo + "/git/ref/heads/" + cfg.branch);
      var headSha = ref.object.sha;
      var commit = await gh("GET", "/repos/" + cfg.repo + "/git/commits/" + headSha);
      var baseTree = commit.tree.sha;

      var g0 = await getJSON("content/galleries.json"), s0 = await getJSON("content/site.json");
      if (g0.sha !== loaded.gSha || s0.sha !== loaded.sSha) {
        throw new Error("La web ha cambiado desde que abriste el panel (¿desde otro ordenador?). Pulsa «Descartar» para cargar la última versión y vuelve a hacer los cambios.");
      }
      var tree = await gh("GET", "/repos/" + cfg.repo + "/git/trees/" + baseTree + "?recursive=1");
      var existing = {}, used = {};
      tree.tree.forEach(function (t) { existing[t.path] = 1; used[t.path] = 1; });

      function newPath(prefix) {
        var p; do { p = "media/" + slug(prefix) + "-" + rand(6) + ".jpg"; } while (used[p]);
        used[p] = 1; return p;
      }
      var queue = [];
      galleries.forEach(function (g) {
        g.photos.forEach(function (p) { if (p.blob && !p.path) { p.path = "/" + newPath(g.title); queue.push(p); } });
      });
      var heroPath = site.heroImage || "";
      if (hero) { hero.path = "/" + newPath("portada"); queue.push(hero); heroPath = hero.path; }

      var entries = [];
      for (var k = 0; k < queue.length; k++) {
        busy("Subiendo fotos… " + (k + 1) + " de " + queue.length);
        var b = await gh("POST", "/repos/" + cfg.repo + "/git/blobs", { content: await toB64(queue[k].blob), encoding: "base64" });
        entries.push({ path: queue[k].path.replace(/^\//, ""), mode: "100644", type: "blob", sha: b.sha });
      }

      busy("Guardando galerías…");
      var gOut = galleries.map(function (g) {
        return { title: g.title.trim(), date: g.date, description: g.description, photos: g.photos.map(function (p) { return p.path; }) };
      });
      var sOut = {}; Object.keys(site).forEach(function (key) { sOut[key] = site[key]; });
      sOut.heroImage = heroPath;
      entries.push({ path: "content/galleries.json", mode: "100644", type: "blob", content: JSON.stringify(gOut, null, 2) + "\n" });
      entries.push({ path: "content/site.json", mode: "100644", type: "blob", content: JSON.stringify(sOut, null, 2) + "\n" });

      // fotos que ya no se usan en ningún sitio
      var keep = {};
      gOut.forEach(function (g) { g.photos.forEach(function (p) { keep[p] = 1; }); });
      if (heroPath) keep[heroPath] = 1;
      Object.keys(loaded.paths).forEach(function (p) {
        var rel = p.replace(/^\//, "");
        if (!keep[p] && /^media\//.test(rel) && existing[rel]) entries.push({ path: rel, mode: "100644", type: "blob", sha: null });
      });

      busy("Publicando…");
      var nt = await gh("POST", "/repos/" + cfg.repo + "/git/trees", { base_tree: baseTree, tree: entries });
      var nc = await gh("POST", "/repos/" + cfg.repo + "/git/commits", {
        message: "Actualizar la web desde el panel", tree: nt.sha, parents: [headSha] });
      await gh("PATCH", "/repos/" + cfg.repo + "/git/refs/heads/" + cfg.branch, { sha: nc.sha });

      queue.forEach(function (q) { thumbs[q.path] = q.url; });
      await loadData();
      unbusy(); renderList(); renderEditor(); if (tab === "site") renderSite();
      toast("Publicado. La web se actualizará en 1–2 minutos.");
    } catch (e) {
      unbusy(); toast(friendly(e), true);
    }
  }

  /* ---------- entrada / salida ---------- */
  function loginMsg(t, err) { var m = $("login-msg"); m.textContent = t; m.className = "msg" + (err ? " err" : ""); }
  function guessRepo() {
    var host = location.hostname, parts = location.pathname.split("/").filter(Boolean);
    if (/\.github\.io$/.test(host)) return host.split(".")[0] + "/" + (parts.length >= 2 ? parts[0] : host);
    return "";
  }
  function saveLogin() { try { localStorage.setItem(STORE, JSON.stringify({ repo: cfg.repo, token: cfg.token })); } catch (e) { /* sin almacenamiento */ } }
  function forgetLogin() { try { localStorage.removeItem(STORE); } catch (e) { /* nada */ } }

  async function connect() {
    cfg.repo = $("repo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
    cfg.token = $("token").value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(cfg.repo)) { loginMsg("Escribe el repositorio como usuario/nombre.", true); return; }
    if (!cfg.token) { loginMsg("Pega la clave de acceso.", true); return; }
    loginMsg("Conectando…"); $("connect").disabled = true;
    try {
      var r = await gh("GET", "/repos/" + cfg.repo);
      cfg.branch = r.default_branch || "main";
      await loadData();
      if ($("remember").checked) saveLogin(); else forgetLogin();
      $("login").hidden = true; $("app").hidden = false;
      setTab("galleries"); renderList(); renderEditor();
    } catch (e) { loginMsg(friendly(e), true); }
    $("connect").disabled = false;
  }

  $("connect").addEventListener("click", connect);
  $("token").addEventListener("keydown", function (e) { if (e.key === "Enter") connect(); });
  $("logout").addEventListener("click", function () {
    if (dirty && !confirm("Hay cambios sin publicar. ¿Salir igualmente?")) return;
    forgetLogin(); dirty = false; location.reload();
  });
  $("new-gallery").addEventListener("click", function () {
    galleries.unshift({ k: ++uid, title: "", date: new Date().toISOString().slice(0, 10), description: "", photos: [] });
    sel = 0; markDirty(); setTab("galleries"); renderList(); renderEditor();
    var t = $("g-title"); if (t) t.focus();
  });
  $("publish").addEventListener("click", publish);
  $("discard").addEventListener("click", async function () {
    if (!confirm("¿Descartar los cambios sin publicar?")) return;
    busy("Cargando…");
    try { await loadData(); renderList(); renderEditor(); if (tab === "site") renderSite(); }
    catch (e) { toast(friendly(e), true); }
    unbusy();
  });
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
    b.addEventListener("click", function () { setTab(b.dataset.tab); });
  });

  (function init() {
    $("repo").value = guessRepo();
    try {
      var saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved && saved.repo && saved.token) { $("repo").value = saved.repo; $("token").value = saved.token; connect(); }
    } catch (e) { /* sin datos guardados */ }
  })();
})();
