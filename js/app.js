/* Web de fotografía — sin dependencias ni proceso de compilación.
   Lee /content/site.json y /content/galleries.json (los edita el panel). */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var topbar = document.getElementById("topbar");
  var brand = document.getElementById("brand");
  var site = {};
  var galleries = [];
  var current = []; // fotos de la galería abierta
  var idx = 0;

  /* ---------- utilidades ---------- */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "class") el.className = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function slugify(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "galeria";
  }
  // Funciona en cualquier alojamiento (también en subcarpetas): quita la "/" inicial
  function rel(p) {
    p = String(p || "");
    return /^(https?:)?\/\//i.test(p) ? p : p.replace(/^\/+/, "");
  }
  function safeUrl(u) {
    return /^(https?:|mailto:|tel:)/i.test(u || "") ? u : "";
  }
  function fetchJSON(url, fallback) {
    return fetch(url, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return fallback; });
  }
  var ICONS = {
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  function iconLink(kind, href, label) {
    var a = h("a", { class: "icon-link", href: href });
    if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
    var wrap = document.createElement("span");
    wrap.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[kind] + "</svg>";
    a.appendChild(wrap.firstChild);
    a.appendChild(h("span", { text: label }));
    return a;
  }
  function contactLinks(into) {
    var out = [];
    var ig = safeUrl(site.instagram), fb = safeUrl(site.facebook);
    if (ig) out.push(iconLink("instagram", ig, "Instagram"));
    if (fb) out.push(iconLink("facebook", fb, "Facebook"));
    if (site.email) out.push(iconLink("mail", "mailto:" + site.email, site.email));
    if (site.phone) out.push(iconLink("phone", "tel:" + String(site.phone).replace(/[^\d+]/g, ""), site.phone));
    out.forEach(function (n) { into.appendChild(n); });
    return out.length;
  }
  function img(src, alt, eager) {
    var i = h("img", { src: src, alt: alt || "", decoding: "async" });
    if (!eager) i.loading = "lazy";
    return i;
  }
  function plural(n) { return n + (n === 1 ? " foto" : " fotos"); }

  /* ---------- vistas ---------- */
  function footer() {
    var f = h("footer", { class: "footer", id: "contacto" });
    var sec = h("div", { class: "section" });
    sec.appendChild(h("div", { class: "section-head" }, [
      h("p", { class: "eyebrow", text: "Contacto" }),
      h("h2", { text: "Hablemos" })
    ]));
    var grid = h("div", { class: "contact-grid" });
    var n = contactLinks(grid);
    if (site.location) grid.appendChild(iconLink("pin", "#/", site.location));
    if (n || site.location) sec.appendChild(grid);
    sec.appendChild(h("p", { class: "copy", text: "© " + new Date().getFullYear() + " " + (site.name || "") }));
    f.appendChild(sec);
    return f;
  }

  function renderHome() {
    app.textContent = "";
    var hero = h("section", { class: "hero" });
    if (site.heroImage) {
      var hi = img(rel(site.heroImage), site.name || "", true);
      hi.className = "hero-img";
      hero.appendChild(hi);
    }
    var inner = h("div", { class: "hero-inner" });
    var title = h("div", {}, [
      h("h1", { text: site.name || "" }),
      site.tagline ? h("p", { class: "tagline", text: site.tagline }) : null
    ]);
    var links = h("div", { class: "hero-links" });
    var row = h("div", { class: "row" });
    contactLinks(row);
    links.appendChild(row);
    inner.appendChild(title);
    if (row.children.length) inner.appendChild(links);
    hero.appendChild(inner);
    hero.appendChild(h("span", { class: "scroll-hint", "aria-hidden": "true" }));
    app.appendChild(hero);

    var sec = h("section", { class: "section", id: "galerias" });
    var head = h("div", { class: "section-head" }, [
      h("p", { class: "eyebrow", text: "Portfolio" }),
      h("h2", { text: "Galerías" })
    ]);
    if (site.about) head.appendChild(h("p", { class: "about", text: site.about }));
    sec.appendChild(head);

    if (!galleries.length) {
      sec.appendChild(h("p", { class: "empty", text: "Pronto habrá fotos por aquí." }));
    } else {
      var cards = h("div", { class: "cards" });
      galleries.forEach(function (g) {
        var cover = g.photos[0];
        var a = h("a", { class: "card", href: "#/g/" + g.slug }, [
          h("div", { class: "card-img" }, [cover ? img(cover, g.title) : null]),
          h("div", { class: "card-meta" }, [
            h("h3", { text: g.title }),
            h("span", { class: "count", text: plural(g.photos.length) })
          ])
        ]);
        cards.appendChild(a);
      });
      sec.appendChild(cards);
    }
    app.appendChild(sec);
    app.appendChild(footer());
    setTop(true);
    document.title = site.name ? site.name + " — " + (site.tagline || "Fotografía") : "Fotografía";
  }

  function renderGallery(slug) {
    var g = galleries.filter(function (x) { return x.slug === slug; })[0];
    if (!g) { location.hash = "#/"; return; }
    app.textContent = "";
    var sec = h("section", { class: "section gallery" });
    sec.appendChild(h("a", { class: "back", href: "#/", text: "← Todas las galerías" }));
    var head = h("div", { class: "gallery-head" }, [
      h("p", { class: "eyebrow", text: formatDate(g.date) || plural(g.photos.length) }),
      h("h1", { text: g.title }),
      g.description ? h("p", { text: g.description }) : null
    ]);
    sec.appendChild(head);

    current = g.photos;
    var m = h("div", { class: "masonry" });
    g.photos.forEach(function (src, i) {
      var b = h("button", { class: "shot", type: "button", "aria-label": "Ampliar foto " + (i + 1) });
      var im = img(src, g.title + " — foto " + (i + 1));
      im.addEventListener("load", function () { im.classList.add("loaded"); });
      if (im.complete) im.classList.add("loaded");
      b.appendChild(im);
      b.addEventListener("click", function () { openLightbox(i); });
      m.appendChild(b);
    });
    sec.appendChild(m);
    app.appendChild(sec);
    app.appendChild(footer());
    setTop(false);
    window.scrollTo(0, 0);
    document.title = g.title + " — " + (site.name || "Fotografía");
  }

  function formatDate(d) {
    if (!d) return "";
    var dt = new Date(d);
    if (isNaN(dt)) return "";
    return dt.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
  }

  function setTop(overHero) {
    topbar.dataset.hero = overHero ? "1" : "0";
    updateTop();
  }
  function updateTop() {
    var overHero = topbar.dataset.hero === "1";
    var solid = !overHero || window.scrollY > window.innerHeight * 0.6;
    topbar.classList.toggle("solid", solid);
  }
  window.addEventListener("scroll", updateTop, { passive: true });

  /* ---------- visor de fotos ---------- */
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lb-img");
  var lbCap = document.getElementById("lb-cap");
  var lbDl = document.getElementById("lb-dl");
  function show(i) {
    idx = (i + current.length) % current.length;
    lbImg.src = current[idx];
    lbCap.textContent = (idx + 1) + " / " + current.length;
    lbDl.href = current[idx];
    lbDl.setAttribute("download", decodeURIComponent(current[idx].split("/").pop().split("?")[0]));
    [idx + 1, idx - 1].forEach(function (j) {
      var p = new Image(); p.src = current[(j + current.length) % current.length];
    });
  }
  function openLightbox(i) {
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    show(i);
  }
  function closeLightbox() {
    lb.hidden = true;
    lbImg.removeAttribute("src");
    document.body.style.overflow = "";
  }
  document.getElementById("lb-close").addEventListener("click", closeLightbox);
  document.getElementById("lb-prev").addEventListener("click", function () { show(idx - 1); });
  document.getElementById("lb-next").addEventListener("click", function () { show(idx + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") show(idx - 1);
    else if (e.key === "ArrowRight") show(idx + 1);
  });
  var tx = null;
  lb.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  });

  /* ---------- rutas ---------- */
  function route() {
    var hash = location.hash || "#/";
    var m = hash.match(/^#\/g\/(.+)$/);
    if (m) { renderGallery(decodeURIComponent(m[1])); return; }
    if (hash === "#/contacto") {
      if (!document.getElementById("contacto")) renderHome();
      document.getElementById("contacto").scrollIntoView();
      return;
    }
    renderHome();
    if (hash === "#/galerias") document.getElementById("galerias").scrollIntoView();
    else window.scrollTo(0, 0);
  }

  /* ---------- arranque ---------- */
  Promise.all([
    fetchJSON("content/site.json", {}),
    fetchJSON("content/galleries.json", [])
  ]).then(function (r) {
    site = r[0] || {};
    var list = Array.isArray(r[1]) ? r[1] : (r[1] && r[1].galleries) || [];
    var seen = {};
    galleries = list.filter(function (g) { return g && g.title; }).map(function (g) {
      var s = slugify(g.title), n = 1, base = s;
      while (seen[s]) { s = base + "-" + (++n); }
      seen[s] = true;
      return {
        title: g.title, slug: s, date: g.date || "", description: g.description || "",
        photos: (g.photos || []).filter(Boolean).map(rel)
      };
    }).filter(function (g) { return g.photos.length; });
    galleries.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    brand.textContent = site.name || "Fotografía";
    brand.href = "#/";
    // enlaces del menú
    document.querySelector('[data-nav="home"]').setAttribute("href", "#/galerias");
    document.querySelector('[data-nav="contact"]').setAttribute("href", "#/contacto");
    window.addEventListener("hashchange", route);
    route();
  });
})();
