/* Motion: the opening sequence, reveals as rooms come into view, headings blown away by Zephyr's
   wind as they leave, magnetic glass buttons that squash when pressed, tilting cards, the nav. */
(() => {
  const { reduce, fine, clamp, pointer, scroll, tasks, split, spring } = TC;
  const out = "cubic-bezier(.16,1,.3,1)";

  const nav = document.getElementById("nav");
  const name = document.getElementById("nm");
  const svs = [...document.querySelectorAll(".sv")];
  svs.forEach((el) => split(el));
  name._chars.forEach((c, i) => c.style.setProperty("--i", i));
  document.querySelectorAll(".stop").forEach((el) => el.prepend(Object.assign(document.createElement("span"), { className: "glow" })));

  /* ---------- opening sequence ---------- */
  if (!reduce) {
    const rise = (el, delay, from) => el && el.animate([from, { opacity: 1, transform: "none", filter: "blur(0px)" }], { duration: 1200, delay, easing: out, fill: "backwards" });
    nav.animate([{ opacity: 0, transform: "translateY(-34px) scale(.8)", filter: "blur(10px)" }, { opacity: 1, transform: "none", filter: "blur(0px)" }], { duration: 1300, delay: 200, easing: spring, fill: "backwards" });
    rise(document.querySelector(".hero .eyebrow"), 120, { opacity: 0, transform: "translateY(16px)", filter: "blur(8px)" });
    name._chars.forEach((c, i) => c.animate([
      { opacity: 0, transform: "translateY(.9em) rotateX(-80deg) scale(.86)", filter: "blur(16px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ], { duration: 1400, delay: 160 + i * 58, easing: out, fill: "backwards" }));
    rise(document.querySelector(".hero .lede"), 760, { opacity: 0, transform: "translateY(22px)", filter: "blur(10px)" });
    document.querySelectorAll(".hero .btn").forEach((b, i) => b.animate(
      [{ opacity: 0, transform: "translateY(18px) scale(.6)" }, { opacity: 1, transform: "none" }],
      { duration: 1100, delay: 980 + i * 130, easing: spring, fill: "backwards" }));
    const label = document.querySelector(".hero .label");
    // the last of the opening to land; the rims then take their light from where it all settled
    label.animate([
      { opacity: 0, transform: "scale(.78) translateY(30px)", filter: "blur(20px)", borderRadius: "80px" },
      { opacity: 1, transform: "none", filter: "blur(0px)", borderRadius: "24px" },
    ], { duration: 1500, delay: 820, easing: spring, fill: "backwards" }).finished.then(TC.relight, () => {});
  }

  /* ---------- reveal as each room arrives ---------- */
  const pending = new Set();
  if (!reduce) {
    document.querySelectorAll(".rv, .sv").forEach((el) => {
      if (el !== name && el.getBoundingClientRect().top > innerHeight) pending.add(el);
    });
    // the portrait stays dark and the exit index undrawn until their rooms arrive
    pending.forEach((el) => {
      if (el.classList.contains("art")) el.classList.add("dark");
      else if (el.querySelector(".index")) el.classList.add("pre");
    });
  }
  function reveal(el) {
    const d = +(el.dataset.d || 0);
    if (el.classList.contains("sv")) {
      (el._chars || []).forEach((c, i) => c.animate([
        { opacity: 0, transform: "translateY(.7em) rotate(12deg) scale(.7)", filter: "blur(10px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" },
      ], { duration: 1100, delay: d + 160 + i * 26, easing: out, fill: "backwards" }));
      return;
    }
    el.animate([
      { opacity: 0, transform: "perspective(1000px) translateY(90px) rotateX(16deg) scale(.88)", filter: "blur(16px)" },
      { opacity: 1, transform: "perspective(1000px) translateY(0px) rotateX(0deg) scale(1)", filter: "blur(0px)" },
    ], { duration: 1400, delay: d, easing: spring, fill: "backwards" }).finished.then(TC.relight, () => {});
    if (el.classList.contains("art")) { el.classList.remove("dark"); el.classList.add("lit"); }
    el.classList.remove("pre");
  }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting || !pending.has(e.target)) return;
    pending.delete(e.target);
    io.unobserve(e.target);
    reveal(e.target);
  }), { rootMargin: "0px 0px 6% 0px" });
  pending.forEach((el) => io.observe(el));

  /* ---------- Zephyr's wind: headings scatter as they leave the top ---------- */
  function vanish(el) {
    const chars = el._chars;
    if (!chars || !chars.length) return;
    const r = el.getBoundingClientRect();
    const vh = innerHeight;
    const p = clamp((vh * 0.2 - r.top) / (vh * 0.2 + r.height * 0.9));
    if (p <= 0 && !el._gone) return;
    el._gone = p > 0;
    const n = chars.length;
    chars.forEach((c, i) => {
      const s = c._s || (c._s = [Math.random(), Math.random(), Math.random()]);
      const q = clamp((p - (i / n) * 0.45 - s[0] * 0.08) / 0.5);
      if (q <= 0) {
        if (c._q) { c.style.transform = ""; c.style.opacity = ""; c._q = 0; }
        return;
      }
      const e = q * q;
      c._q = q;
      c.style.transform = `translate3d(${(e * (70 + s[1] * 180)).toFixed(1)}px, ${(-e * (30 + s[2] * 140)).toFixed(1)}px, 0) rotate(${(e * (s[1] - 0.4) * 160).toFixed(1)}deg) scale(${(1 - e * 0.55).toFixed(3)})`;
      c.style.opacity = (1 - q).toFixed(3);
    });
  }

  /* ---------- glass panes fade and sink as they leave ---------- */
  const exits = [...document.querySelectorAll(".rv, .ex")];
  function exit(el) {
    const r = el.getBoundingClientRect();
    const p = clamp((innerHeight * 0.26 - r.bottom) / (innerHeight * 0.26));
    if (p <= 0 && !el._out) return;
    el._out = p > 0;
    el.style.opacity = p > 0 ? (1 - p * 0.9).toFixed(3) : "";
    el.style.scale = p > 0 ? (1 - p * 0.08).toFixed(3) : "";
    el.style.translate = p > 0 ? `0 ${(-p * 40).toFixed(1)}px` : "";
  }

  /* ---------- magnetic glass buttons, jelly on press ---------- */
  const mags = [...document.querySelectorAll(".mag")];
  if (!reduce) {
    mags.forEach((el) => el.addEventListener("pointerdown", () => el.animate([
      { scale: "1 1" }, { scale: "1.14 .88", offset: 0.25 }, { scale: ".94 1.07", offset: 0.55 }, { scale: "1.02 .99", offset: 0.8 }, { scale: "1 1" },
    ], { duration: 680, easing: "ease-out" })));
    const seg = document.querySelector(".seg");
    seg.addEventListener("pointerdown", () => seg.animate([{ scale: "1 1" }, { scale: "1.08 .92", offset: 0.3 }, { scale: ".98 1.03", offset: 0.65 }, { scale: "1 1" }], { duration: 600, easing: "ease-out" }));
  }
  // both helpers read every rect before writing anything, so each frame costs a single layout,
  // and they only write what changed
  function magnet() {
    mags.map((el) => [el, el.getBoundingClientRect()]).forEach(([el, r]) => {
      const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height / 2);
      const near = pointer.active && Math.abs(dx) < r.width / 2 + 40 && Math.abs(dy) < r.height / 2 + 30;
      const t = near ? `${(dx * 0.22).toFixed(1)}px ${(dy * 0.32).toFixed(1)}px` : "";
      if (t !== el._t) { el._t = t; el.style.translate = t; }
    });
  }

  /* ---------- the name leans toward the cursor ---------- */
  function hoverName() {
    const r0 = name.getBoundingClientRect();
    const near = pointer.active && pointer.y > r0.top - 140 && pointer.y < r0.bottom + 140;
    if (!near && !name._hover) return;
    name._hover = near;
    if (!near) { name._chars.forEach((c) => { c.style.translate = ""; c.style.scale = ""; c._t = ""; }); return; }
    name._chars.map((c) => [c, c.getBoundingClientRect()]).forEach(([c, r]) => {
      const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height / 2);
      const f = Math.exp(-(dx * dx + dy * dy) / (2 * 120 * 120));
      // letters far from the cursor stay put instead of being handed the same values again
      const t = f < 0.004 ? "" : `${(-dx * f * 0.08).toFixed(1)}px ${(-f * 20).toFixed(1)}px`;
      if (t === c._t) return;
      c._t = t;
      c.style.translate = t;
      c.style.scale = t ? (1 + f * 0.12).toFixed(3) : "";
    });
  }

  /* ---------- tilt ---------- */
  if (fine && !reduce) {
    document.querySelectorAll(".tilt").forEach((el) => {
      const max = el.classList.contains("art") ? 7 : 9;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", `${(x * max * 2).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-y * max * 2).toFixed(2)}deg`);
        el.style.setProperty("--gx", (x * 100).toFixed(1));
      });
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--gx", "0");
      });
    });
  }

  /* ---------- nav: liquid blob on the current room, shrinks while you read ---------- */
  const links = [...nav.querySelectorAll(".nav__links a")];
  const blob = nav.querySelector(".nav__blob");
  let active = null, lastY = scrollY;
  function placeBlob(a, jelly) {
    if (!a) { blob.style.opacity = "0"; return; }
    const x = a.offsetLeft, from = blob._x;
    blob.style.opacity = "1";
    blob.style.width = `${a.offsetWidth}px`;
    blob.style.transform = `translateX(${x}px)`;
    blob._x = x;
    if (jelly && !reduce && from != null && from !== x) {
      blob.animate([{ scale: "1 1" }, { scale: "1.4 .78", offset: 0.35 }, { scale: ".92 1.1", offset: 0.7 }, { scale: "1 1" }], { duration: 720, easing: "ease-out" });
    }
  }
  let force = true;
  document.addEventListener("tc:lang", () => { force = true; requestAnimationFrame(() => placeBlob(active, false)); });
  if (document.fonts) document.fonts.ready.then(() => placeBlob(active, false));

  const nums = [...document.querySelectorAll(".room__num")];
  tasks.push(() => {
    if (scroll.changed || force) {
      const y = scrollY, vh = innerHeight;
      if (y < 140 || y < lastY - 3) nav.classList.remove("compact");
      else if (y > lastY + 3) nav.classList.add("compact");
      lastY = y;
      let cur = null;
      links.forEach((a) => {
        const s = document.querySelector(a.getAttribute("href"));
        const r = s && s.getBoundingClientRect();
        if (r && r.top < vh * 0.5 && r.bottom > vh * 0.5) cur = a;
      });
      if (cur !== active) {
        links.forEach((a) => a.classList.toggle("on", a === cur));
        placeBlob(cur, true);
        active = cur;
      }
      if (!reduce) {
        nums.forEach((n) => {
          const r = n.parentElement.getBoundingClientRect();
          n.style.translate = `0 calc(-50% + ${((r.top + r.height / 2 - vh / 2) * -0.3).toFixed(1)}px)`;
        });
        svs.forEach(vanish);
        exits.forEach(exit);
      }
      force = false;
    }
    if (fine && !reduce && (pointer.moved || scroll.changed)) { magnet(); hoverName(); }
  });
})();
