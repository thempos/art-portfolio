/* PT/EN. Portuguese lives in the HTML; English lives here. Switching language moves the letters
   both texts share into their new places, blows the rest away and condenses the new ones. */
(() => {
  const { root, reduce, split, rand, clamp } = TC;

  const EN = {
    "nav.about": "About",
    "nav.journey": "Journey",
    "nav.contact": "Contact",
    "hero.eyebrow": "Room I · The spark",
    "hero.lede": "Software engineer in São Paulo. I like the exact point where <em>an idea touches the code</em>.",
    "cv.download": "Download résumé",
    "label.sub": "Brazilian · São Paulo, Brazil",
    "label.work": "Work",
    "label.workv": "Software Engineering, 2025",
    "label.medium": "Medium",
    "label.mediumv": "Java, Kotlin and React on AWS",
    "label.coll": "Collection",
    "label.oil": "Oil on code",
    "about.eyebrow": "Room II · About",
    "about.title": "From the interface to Terraform, end to end.",
    "about.p1": "I build whole products: screen, API, data and cloud. I've shipped a health platform used by 90,000 people, and today I carefully retire banking systems that have run their course.",
    "about.p2": "Focus, precision and a soft spot for well-finished things, in code and beyond it.",
    "about.a11y": "Accessibility",
    "about.plaque": "Portrait of the artist, 2026",
    "about.alt": "Portrait of Timothée Campos",
    "prov.eyebrow": "Room III · Provenance",
    "prov.title": "Where this work has been",
    "prov.note": "In museums, provenance records every place a piece has been. This is mine.",
    "s.fatec": "Associate degree in Multiplatform Software Development.",
    "s.ion": "Investment analysis. A project that saved over R$ 2M.",
    "s.harvard": "9-week leadership program.",
    "s.mit": "Project on metabolic liver disease (MASH).",
    "s.health.t": "Itaú · People &amp; Health",
    "s.health": "Health platform for 90,000 employees.",
    "s.baas.y": "2026 · now",
    "s.baas": "Safely decommissioning a banking platform.",
    "s.faap": "Graduate program in AI for business.",
    "contact.eyebrow": "Room IV · Exit",
    "contact.title": "Let's talk<span class=\"dot\">.</span>",
    "contact.k.mail": "Email",
    "contact.copy": "Copy",
    "contact.copied": "Copied",
    "contact.k.cv": "Résumé",
    "contact.cv": "PDF in English",
    "foot.end": "End of the exhibition",
    "foot.made": "Handmade in São Paulo",
  };
  const PT = { "contact.copied": "Copiado" };

  const nodes = [...document.querySelectorAll("[data-i18n]")];
  nodes.forEach((el) => { PT[el.dataset.i18n] = el.innerHTML.trim(); el._cur = PT[el.dataset.i18n]; });
  const alts = [...document.querySelectorAll("[data-i18n-alt]")];
  alts.forEach((el) => { PT[el.dataset.i18nAlt] = el.alt; });

  let lang = "pt";
  const t = (key) => (lang === "en" ? EN[key] : PT[key]) ?? PT[key] ?? "";

  /* ---------- the letter engine ---------- */
  const ghostRoot = document.getElementById("ghosts");
  const STYLE = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariationSettings", "fontStretch", "letterSpacing", "textTransform", "color", "textShadow"];

  // pairs each new letter with the closest unused old copy of the exact same glyph
  function match(a, b) {
    const used = new Array(a.length).fill(false);
    const map = new Array(b.length).fill(-1);
    const idx = new Map();
    a.forEach((ch, i) => { if (!ch.trim()) return; if (!idx.has(ch)) idx.set(ch, []); idx.get(ch).push(i); });
    const na = Math.max(1, a.length - 1), nb = Math.max(1, b.length - 1);
    b.forEach((ch, j) => {
      const list = idx.get(ch);
      if (!list) return;
      let best = -1, bd = 2;
      for (const i of list) {
        if (used[i]) continue;
        const d = Math.abs(i / na - j / nb);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0 && bd < 0.5) { used[best] = true; map[j] = best; }
    });
    return { map, used };
  }

  function ghost(o, layer) {
    const g = document.createElement("span");
    g.className = "ghost";
    g.textContent = o.t;
    Object.assign(g.style, o.s, {
      left: `${o.r.left + scrollX}px`, top: `${o.r.top + scrollY}px`,
      width: `${o.r.width}px`, height: `${o.r.height}px`, lineHeight: `${o.r.height}px`,
    });
    layer.append(g);
    return g;
  }

  function finish(job, anims, layer) {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      layer.remove();
      job.el._cleanup = null;
      // long texts go back to plain markup for perfect kerning; headings stay split for the wind
      if (!job.el.classList.contains("sv")) { job.el.innerHTML = job.html; job.el._chars = null; }
    };
    job.el._cleanup = () => { anims.forEach((a) => a.cancel()); end(); };
    Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(end);
  }

  // short text: shared letters travel to their new place
  function morph(job) {
    const { old, chars, rects, base } = job;
    const { map, used } = match(old.map((o) => o.t), chars.map((c) => c.textContent));
    const anims = [];
    const layer = document.createElement("div");
    layer.className = "ghost-layer";
    ghostRoot.append(layer);
    chars.forEach((c, k) => {
      const i = map[k];
      const delay = base + k * 16;
      if (i >= 0) {
        const dx = old[i].r.left - rects[k].left, dy = old[i].r.top - rects[k].top;
        const lift = -Math.min(job.tight ? 9 : 46, 12 + Math.abs(dx) * 0.14 + Math.abs(dy) * 0.25);
        anims.push(c.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) rotate(${dx > 0 ? -10 : 10}deg) scale(1.18)`, offset: 0.5 },
          { transform: "translate(0px, 0px)" },
        ], { duration: 900, delay, easing: "cubic-bezier(.65,0,.25,1)", fill: "backwards" }));
      } else {
        anims.push(c.animate([
          { opacity: 0, transform: "translateY(.6em) scale(.3) rotate(-14deg)", filter: "blur(8px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ], { duration: 820, delay: delay + 300, easing: TC.spring, fill: "backwards" }));
      }
    });
    old.forEach((o, i) => {
      if (used[i] || !o.t.trim()) return;
      const g = ghost(o, layer);
      anims.push(g.animate([
        { opacity: 1, transform: "none", filter: "blur(0px)" },
        { opacity: 0, transform: `translate(${rand(18, 80)}px, ${rand(-56, -14)}px) rotate(${rand(-50, 50)}deg) scale(.4)`, filter: "blur(7px)" },
      ], { duration: rand(560, 900), delay: base + i * 12, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" }));
    });
    finish(job, anims, layer);
  }

  // long text: the old words are blown away like dust, the new ones condense out of the haze
  function blow(job) {
    const { old, chars, base, el } = job;
    const anims = [];
    const layer = document.createElement("div");
    layer.className = "ghost-layer";
    ghostRoot.append(layer);
    const n = old.length || 1;
    old.forEach((o, i) => {
      if (!o.t.trim()) return;
      const g = ghost(o, layer);
      anims.push(g.animate([
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `translate(${rand(50, 190)}px, ${rand(-90, -10)}px) rotate(${rand(-80, 80)}deg) scale(${rand(0.2, 0.7)})` },
      ], { duration: rand(700, 1150), delay: base + (i / n) * 460 + rand(0, 90), easing: "cubic-bezier(.3,.1,.3,1)", fill: "both" }));
    });
    anims.push(layer.animate([{ filter: "blur(0px)" }, { filter: "blur(6px)" }], { duration: 1300, delay: base + 80, fill: "both" }));
    const m = chars.length || 1;
    chars.forEach((c, i) => {
      anims.push(c.animate([
        { opacity: 0, transform: `translate(${rand(-36, -8)}px, ${rand(8, 26)}px) scale(.6)` },
        { opacity: 1, transform: "none" },
      ], { duration: 820, delay: base + 300 + (i / m) * 560, easing: TC.spring, fill: "backwards" }));
    });
    anims.push(el.animate([{ filter: "blur(7px)" }, { filter: "blur(0px)" }], { duration: 1000, delay: base + 300, easing: "ease-out", fill: "backwards" }));
    finish(job, anims, layer);
  }

  function swap(jobs, animate) {
    jobs.forEach((j) => j.el._cleanup && j.el._cleanup());
    const vh = innerHeight;
    const styles = new Map();
    const styleOf = (c) => {
      const host = c.parentElement && c.parentElement.parentElement ? c.parentElement.parentElement : c;
      if (!styles.has(host)) {
        const cs = getComputedStyle(host);
        const o = {};
        STYLE.forEach((p) => { o[p] = cs[p]; });
        styles.set(host, o);
      }
      return styles.get(host);
    };
    // read the old letters
    jobs.forEach((j) => {
      const r = j.el.getBoundingClientRect();
      j.live = animate && !reduce && r.width > 0 && r.bottom > -60 && r.top < vh + 60;
      if (!j.live) return;
      j.base = clamp(r.top / vh) * 280;
      j.long = j.el.textContent.trim().length > 60;
      j.tight = !!j.el.closest(".nav");
      j.old = split(j.el).map((c) => ({ t: c.textContent, r: c.getBoundingClientRect(), s: styleOf(c) }));
    });
    // write the new text
    jobs.forEach((j) => {
      j.el.innerHTML = j.html;
      j.el._chars = null;
      j.el._cur = j.html;
      if (j.live || j.el.classList.contains("sv")) split(j.el);
    });
    // read the new letters, then animate
    jobs.forEach((j) => { if (j.live) { j.chars = j.el._chars; j.rects = j.chars.map((c) => c.getBoundingClientRect()); } });
    jobs.forEach((j) => { if (j.live) (j.long ? blow : morph)(j); });
  }

  /* ---------- the toggle ---------- */
  const seg = document.querySelector(".seg");
  const thumb = seg.querySelector(".seg__thumb");
  const btns = [...seg.querySelectorAll("button")];

  function placeThumb(animate) {
    const b = btns.find((x) => x.dataset.set === lang) || btns[0];
    const x = b.offsetLeft;
    const from = thumb._x == null ? x : thumb._x;
    thumb._x = x;
    thumb.style.transform = `translateX(${x}px)`;
    if (!animate || reduce || from === x) return;
    const dx = x - from;
    thumb.animate([
      { transform: `translateX(${from}px) scale(1, 1)` },
      { transform: `translateX(${from + dx * 0.32}px) scale(1.55, .76)`, offset: 0.28 },
      { transform: `translateX(${x + dx * 0.12}px) scale(.86, 1.14)`, offset: 0.58 },
      { transform: `translateX(${x - dx * 0.04}px) scale(1.06, .95)`, offset: 0.8 },
      { transform: `translateX(${x}px) scale(1, 1)` },
    ], { duration: 780, easing: "cubic-bezier(.3,.6,.2,1)" });
  }

  function setLang(next, animate) {
    if (next !== "en") next = "pt";
    const changed = next !== lang;
    lang = next;
    root.dataset.lang = lang;
    root.lang = lang === "en" ? "en" : "pt-BR";
    try { localStorage.setItem("tc-lang", lang); } catch (e) { /* storage blocked */ }
    btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.set === lang)));
    const jobs = nodes
      .map((el) => ({ el, html: lang === "en" ? EN[el.dataset.i18n] ?? PT[el.dataset.i18n] : PT[el.dataset.i18n] }))
      .filter((j) => j.html != null && j.html !== j.el._cur);
    if (jobs.length) swap(jobs, animate);
    alts.forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
    placeThumb(animate && changed);
    document.dispatchEvent(new CustomEvent("tc:lang", { detail: { lang, animate } }));
  }

  btns.forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.set === lang) return;
    const r = b.getBoundingClientRect();
    if (TC.ripple) TC.ripple(r.left + r.width / 2, r.top + r.height / 2, 1.25);
    setLang(b.dataset.set, true);
  }));

  let initial = "pt";
  try { initial = localStorage.getItem("tc-lang") || ""; } catch (e) { initial = ""; }
  if (!initial) initial = (navigator.language || "pt").toLowerCase().startsWith("pt") ? "pt" : "en";
  setLang(initial, false);
  addEventListener("resize", () => placeThumb(false));
  if (document.fonts) document.fonts.ready.then(() => placeThumb(false));

  TC.t = t;
  TC.lang = () => lang;
  TC.setLang = setLang;
})();
