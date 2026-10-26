/* Liquid glass. Each pane gets a displacement map shaped like its own rounded bevel, so the
   painting behind bends at the edges with a little chromatic fringe. Chromium renders the
   refraction; other browsers keep the frosted blur. Every rim catches the same light. */
(() => {
  const { chromium, fine, pointer, scroll, tasks } = TC;
  const NS = "http://www.w3.org/2000/svg";
  const defs = document.getElementById("lg-defs");
  const panes = [...document.querySelectorAll(".lg")];
  let count = 0;

  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    return e;
  };

  // red/green encode the outward push; flat in the middle, steep at the rim like a real bevel.
  // Maps are kept by size, so a pane that changes back (the nav folding) reuses its old one.
  const maps = new Map();
  function bevelMap(w, h, radius, bezel) {
    const key = `${w}x${h}x${radius}x${bezel}`;
    if (maps.has(key)) return maps.get(key);
    const k = h < 90 ? 1 : 0.5;
    const W = Math.max(2, Math.round(w * k)), H = Math.max(2, Math.round(h * k));
    const R = Math.min(radius * k, W / 2, H / 2), B = Math.max(1, bezel * k);
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    // a CPU canvas: encoding it never waits on the GPU
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5 - W / 2, py = y + 0.5 - H / 2;
        const qx = Math.abs(px) - (W / 2 - R), qy = Math.abs(py) - (H / 2 - R);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
        const inside = Math.min(Math.max(qx, qy), 0);
        const dist = R - (outside + inside); // distance to the edge, positive inside
        let nx = 0, ny = 0, m = 0;
        if (dist < B) {
          if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = qx / l; ny = qy / l; }
          else if (qx > qy) nx = 1;
          else ny = 1;
          nx *= Math.sign(px) || 1;
          ny *= Math.sign(py) || 1;
          const t = Math.min(1, Math.max(0, 1 - dist / B));
          m = 1 - Math.sqrt(1 - t * t);
        }
        const i = (y * W + x) * 4;
        d[i] = 128 + nx * m * 127;
        d[i + 1] = 128 + ny * m * 127;
        d[i + 2] = 128;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = cv.toDataURL();
    maps.set(key, url);
    return url;
  }

  function build(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (w < 8 || h < 8) return;
    const cs = getComputedStyle(el);
    const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
    const bezel = Math.max(5, Math.min(+el.dataset.bezel || 28, radius || 18, h * 0.42, w * 0.42));
    const scale = +el.dataset.refract || Math.min(74, Math.max(30, h * 0.55));
    const blur = el.dataset.blur != null ? +el.dataset.blur : h < 90 ? 1.4 : 9;
    if (!el._lg) {
      el._lg = mk("filter", { id: `lg${++count}`, x: 0, y: 0, filterUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" }, defs);
    }
    const f = el._lg;
    f.setAttribute("width", w);
    f.setAttribute("height", h);
    f.textContent = "";
    const map = mk("feImage", { x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none", result: "map" }, f);
    map.setAttribute("href", bevelMap(w, h, radius, bezel));
    if (h < 90) {
      // small panes: one displacement per channel gives the prism fringe at the rim
      [["r", 1, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"], ["g", 0.9, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"], ["b", 0.8, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"]].forEach(([c, s, m]) => {
        mk("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: (scale * s).toFixed(1), xChannelSelector: "R", yChannelSelector: "G", result: `d${c}` }, f);
        mk("feColorMatrix", { in: `d${c}`, type: "matrix", values: m, result: c }, f);
      });
      mk("feBlend", { in: "r", in2: "g", mode: "screen", result: "rg" }, f);
      mk("feBlend", { in: "rg", in2: "b", mode: "screen" }, f);
    } else {
      // large panes bend in a single pass: the fringe is lost under their heavy blur, the cost is not
      mk("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: scale.toFixed(1), xChannelSelector: "R", yChannelSelector: "G" }, f);
    }
    const value = `url(#${f.id}) blur(${blur}px) saturate(1.8) brightness(1.07)`;
    el.style.webkitBackdropFilter = value;
    el.style.backdropFilter = value;
    el.dataset.refracting = "";
  }

  if (chromium) {
    const ro = new ResizeObserver((entries) => entries.forEach(({ target: el }) => {
      // a stretched map would push the whole pane sideways, so fall back to frost until it settles
      if (el._lg) { el.style.backdropFilter = ""; el.style.webkitBackdropFilter = ""; }
      clearTimeout(el._lgT);
      el._lgT = setTimeout(() => build(el), 160);
    }));
    panes.filter((el) => fine || el.dataset.lg === "always").forEach((el) => ro.observe(el));
  }

  /* one light for every rim: the mouse, or a lamp above the room when it leaves the window.
     Moving a rim's light repaints its whole pane, so while the page moves only the panes near
     the light follow it; the far ones, whose rims barely change, catch up once things come to
     rest. Touch screens keep the rims as the stylesheet draws them. */
  TC.relight = () => {};
  if (!fine) return;
  const NEAR = 260;
  let rest = 0;
  // a pane that has just finished moving on its own (an entrance) asks for one more pass
  TC.relight = () => { rest = performance.now(); };
  tasks.push((now) => {
    const moving = scroll.changed || pointer.moved;
    if (moving) rest = now + 180;
    else if (!rest || now < rest) return;
    const all = !moving;
    if (all) rest = 0;
    const lx = pointer.active ? pointer.x : innerWidth * 0.5, ly = pointer.active ? pointer.y : innerHeight * 0.18;
    const vh = innerHeight;
    // read every rect first, then write, so the browser lays out once
    const lit = [];
    for (const el of panes) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < -40 || r.top > vh + 40) continue;
      const near = Math.max(r.left - lx, lx - r.right, r.top - ly, ly - r.bottom) < NEAR;
      // a pane that was near gets one last update as the light leaves it, and a pane seen for
      // the first time gets its light straight away
      if (all || near || el._near || el._lx == null) lit.push([el, r]);
      el._near = near;
    }
    for (const [el, r] of lit) {
      const x = `${(((lx - r.left) / r.width) * 100).toFixed(1)}%`, y = `${(((ly - r.top) / r.height) * 100).toFixed(1)}%`;
      if (x !== el._lx) { el._lx = x; el.style.setProperty("--lx", x); }
      if (y !== el._ly) { el._ly = y; el.style.setProperty("--ly", y); }
    }
  });
})();
