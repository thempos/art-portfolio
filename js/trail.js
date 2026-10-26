/* The gilded thread: three strands that loop through the rooms behind the glass, drawn as you
   scroll, with a glowing tip that sheds sparks. Each strand is cut into short pieces, so drawing
   it repaints only the piece where it is growing, never the whole height of the page. The tip is
   an HTML bead that travels and pulses on the compositor, so a still page costs nothing. */
(() => {
  const { reduce, clamp, rand, tasks } = TC;
  const svg = document.getElementById("trail");
  const main = document.querySelector("main");
  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    return e;
  };
  const f1 = (v) => v.toFixed(1);

  // Catmull-Rom through the points, as cubic Béziers [x0, y0, x1, y1, x2, y2, x3, y3]
  const beziers = (pts) => pts.slice(0, -1).map((p1, i) => {
    const p0 = pts[i - 1] || p1, p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    return [p1[0], p1[1], p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]];
  });

  // de Casteljau: the same curve, cut in two at t
  const cut = ([x0, y0, x1, y1, x2, y2, x3, y3], t) => {
    const m = (a, b) => a + (b - a) * t;
    const ax = m(x0, x1), ay = m(y0, y1), bx = m(x1, x2), by = m(y1, y2), cx = m(x2, x3), cy = m(y2, y3);
    const dx = m(ax, bx), dy = m(ay, by), ex = m(bx, cx), ey = m(by, cy), fx = m(dx, ex), fy = m(dy, ey);
    return [[x0, y0, ax, ay, dx, dy, fx, fy], [fx, fy, ex, ey, cx, cy, x3, y3]];
  };
  const roughLength = ([x0, y0, x1, y1, x2, y2, x3, y3]) =>
    (Math.hypot(x3 - x0, y3 - y0) + Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)) / 2;

  // the curve as path data in pieces of roughly PIECE px each
  const PIECE = 300;
  const pieces = (pts) => {
    const out = [];
    let run = [], len = 0;
    beziers(pts).forEach((b) => {
      const n = Math.max(1, Math.ceil(roughLength(b) / PIECE));
      let rest = b;
      for (let k = 0; k < n; k++) {
        let part = rest;
        if (k < n - 1) [part, rest] = cut(rest, 1 / (n - k));
        run.push(part);
        len += roughLength(part);
        if (len >= PIECE) { out.push(run); run = []; len = 0; }
      }
    });
    if (run.length) out.push(run);
    return out.map((run) => `M${f1(run[0][0])},${f1(run[0][1])}` +
      run.map((b) => `C${f1(b[2])},${f1(b[3])} ${f1(b[4])},${f1(b[5])} ${f1(b[6])},${f1(b[7])}`).join(""));
  };

  // swings across the page and ties itself in loops every few bends
  const route = (W, H, phase, amp) => {
    const pts = [];
    const steps = Math.max(8, Math.round(H / 420));
    const r = Math.min(W * 0.09, 84);
    for (let i = 0; i <= steps; i++) {
      const y = (i / steps) * H * 0.985 + 10;
      const x = W / 2 + Math.sin(i * 1.15 + phase) * W * amp + Math.sin(i * 0.37 + phase * 2) * W * 0.06;
      pts.push([x, y]);
      if (i > 0 && i < steps && (i + Math.round(phase * 3)) % 3 === 0) {
        const dir = Math.cos(i * 1.15 + phase) > 0 ? 1 : -1;
        const cy = y + r;
        pts.push([x + dir * r * 1.1, cy - r * 0.2], [x + dir * r * 0.2, cy + r * 0.9], [x - dir * r * 0.9, cy + r * 0.1], [x - dir * r * 0.1, cy - r * 0.8], [x + dir * r * 0.7, y + r * 1.4]);
      }
    }
    return pts;
  };

  /* A strand is a group of pieces laid end to end. The opacity sits on the group, so where two
     pieces overlap at a joint they blend once, exactly like the single path they replace. */
  function strand(pts, attrs, lag) {
    const g = mk("g", Object.assign({ fill: "none", "stroke-linecap": "round" }, attrs), svg);
    let at = 0;
    const parts = pieces(pts).map((d) => {
      const el = mk("path", { d }, g);
      const L = el.getTotalLength();
      const part = { el, at, L, shown: null };
      at += L;
      return part;
    });
    return { parts, L: at, lag };
  }

  // each piece is hidden, whole, or cut where the thread has reached; only changes are written
  function reach(s, len) {
    s.parts.forEach((p) => {
      const v = clamp(len - p.at, 0, p.L);
      const next = v < 0.5 ? -1 : v > p.L - 0.5 ? p.L : Math.round(v * 10) / 10;
      if (next === p.shown) return;
      const was = p.shown;
      p.shown = next;
      const st = p.el.style;
      if (next < 0) { st.visibility = "hidden"; return; }
      if (was == null || was < 0) st.visibility = "";
      if (next === p.L) { st.strokeDasharray = ""; st.strokeDashoffset = ""; return; }
      st.strokeDasharray = `${p.L} ${p.L}`;
      st.strokeDashoffset = p.L - next;
    });
  }

  const tip = Object.assign(document.createElement("span"), { className: "trail-tip" });
  tip.setAttribute("aria-hidden", "true");
  svg.after(tip);

  let strands = [], sparks = [], live = 0, shown = 0, built = false, last = null, still, top = 0, height = 1;

  function build() {
    const W = main.clientWidth, H = main.scrollHeight;
    if (!W || !H) return;
    top = main.getBoundingClientRect().top + scrollY;
    height = H;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.textContent = "";
    const defs = mk("defs", {}, svg);
    const g1 = mk("linearGradient", { id: "tg1", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: W * 0.3, y2: H }, defs);
    [[0, "#e2b867"], [0.26, "#ef907c"], [0.52, "#79c4b2"], [0.78, "#6487ff"], [1, "#e2b867"]].forEach(([o, c]) => mk("stop", { offset: o, "stop-color": c }, g1));
    const g2 = mk("linearGradient", { id: "tg2", gradientUnits: "userSpaceOnUse", x1: W, y1: 0, x2: 0, y2: H }, defs);
    [[0, "#79c4b2"], [0.5, "#e2b867"], [1, "#ef907c"]].forEach(([o, c]) => mk("stop", { offset: o, "stop-color": c }, g2));

    const narrow = W < 700;
    const main0 = route(W, H, 0.2, narrow ? 0.3 : 0.36);

    // the stitching is laid out whole, a dotted pattern for the thread to follow; each piece
    // starts its dashes where the last one stopped, so the dots keep their rhythm
    const stitch = mk("g", { fill: "none", stroke: "#f6eedf", "stroke-width": 1.6, "stroke-linecap": "round", "stroke-dasharray": "1 11", opacity: 0.32 }, svg);
    let at = 0;
    pieces(route(W, H, 4.3, narrow ? 0.26 : 0.3)).forEach((d) => {
      const el = mk("path", { d, "stroke-dashoffset": f1(at % 12) }, stitch);
      at += el.getTotalLength();
    });

    strands = [
      strand(main0, { stroke: "url(#tg1)", "stroke-width": narrow ? 10 : 16, opacity: 0.13 }, 1),
      strand(main0, { stroke: "url(#tg1)", "stroke-width": narrow ? 2 : 2.6 }, 1),
      strand(route(W, H, 2.4, narrow ? 0.34 : 0.42), { stroke: "url(#tg2)", "stroke-width": 1, opacity: 0.6 }, 0.95),
    ];
    sparks = Array.from({ length: 28 }, () => ({ el: mk("circle", { r: 0, fill: "#e2b867" }, svg), life: 0, x: 0, y: 0, vx: 0, vy: 0, decay: 0 }));
    live = 0;
    built = true;
    last = null;
    draw(true, performance.now(), 16);
    tip.classList.add("on");
  }

  function spawn(x, y) {
    const s = sparks.find((p) => p.life <= 0);
    if (!s) return;
    Object.assign(s, { x, y, vx: rand(-0.9, 0.9), vy: rand(-1.4, 0.2), life: 1, decay: rand(0.012, 0.026) });
    s.el.setAttribute("fill", ["#e2b867", "#ef907c", "#f6eedf", "#79c4b2"][Math.floor(Math.random() * 4)]);
    live++;
  }

  function draw(force, now, dt) {
    const target = reduce ? 1 : clamp((scrollY - top + innerHeight * 0.62) / height, 0.03, 1);
    // a still thread with no sparks in the air: nothing to repaint
    if (!force && shown === target && !live) return;
    const before = shown;
    shown = force ? target : shown + (target - shown) * (1 - Math.exp(-dt / 140));
    if (Math.abs(target - shown) < 0.0002) shown = target;
    if (force || shown !== before) {
      strands.forEach((s) => reach(s, s.L * shown * s.lag));
      const core = strands[1], len = core.L * shown;
      const piece = core.parts.find((q) => len <= q.at + q.L) || core.parts[core.parts.length - 1];
      const p = piece.el.getPointAtLength(clamp(len - piece.at, 0, piece.L));
      tip.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (!reduce && last && Math.hypot(p.x - last.x, p.y - last.y) > 5) { spawn(p.x, p.y); spawn(p.x, p.y); }
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 5) last = { x: p.x, y: p.y };
      // the halo pulses while the thread is being drawn and rests once it stops
      if (!reduce) {
        tip.classList.add("moving");
        clearTimeout(still);
        still = setTimeout(() => tip.classList.remove("moving"), 1400);
      }
    }
    if (!live) return;
    const f = dt / 16;
    live = 0;
    sparks.forEach((s) => {
      if (s.life <= 0) return;
      s.x += s.vx * f; s.y += s.vy * f; s.vy += 0.05 * f; s.life -= s.decay * f;
      const life = Math.max(0, s.life);
      if (life > 0) live++;
      s.el.setAttribute("cx", s.x.toFixed(1));
      s.el.setAttribute("cy", s.y.toFixed(1));
      s.el.setAttribute("r", (2.3 * life).toFixed(2));
      s.el.setAttribute("opacity", life.toFixed(2));
    });
  }

  tasks.push((now, dt) => { if (built) draw(false, now, dt); });
  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 200); }).observe(main);
})();
