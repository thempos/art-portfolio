/* Shared state for every module: capabilities, pointer, scroll, one animation loop, text splitting. */
window.TC = (() => {
  const root = document.documentElement;
  const mq = (q) => window.matchMedia(q).matches;
  const reduce = mq("(prefers-reduced-motion: reduce)");
  const fine = mq("(hover: hover) and (pointer: fine)");
  const ua = navigator.userAgent;
  // SVG filters inside backdrop-filter (the real refraction) only render in Chromium engines.
  const chromium = /Chrome\/\d+/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const spring = CSS.supports("transition-timing-function", "linear(0, 1)")
    ? "linear(0, 0.0372, 0.1332, 0.2658, 0.4163, 0.5693, 0.7133, 0.8404, 0.946, 1.0282, 1.0871, 1.1246, 1.1436, 1.1474, 1.1399, 1.1243, 1.104, 1.0815, 1.0591, 1.0382, 1.0201, 1.0052, 0.9938, 0.9857, 0.9808, 0.9785, 0.9783, 0.9797, 0.9822, 0.9853, 0.9887, 0.9919, 0.9949, 0.9975, 0.9996, 1.0012, 1.0023, 1.0029, 1.0032, 1.0032, 1)"
    : "cubic-bezier(.34,1.56,.64,1)";

  const pointer = { x: innerWidth / 2, y: innerHeight / 3, active: false, moved: true, t: 0, ui: false };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.active = true; pointer.moved = true; pointer.t = performance.now();
    pointer.ui = !!(e.target.closest && e.target.closest("a, button, .lg, .art"));
  }, { passive: true });
  root.addEventListener("mouseleave", () => { pointer.active = false; pointer.moved = true; });

  const scroll = { changed: true };
  addEventListener("scroll", () => { scroll.changed = true; }, { passive: true });
  addEventListener("resize", () => { scroll.changed = true; });

  // one loop; each module reads the flags and decides whether it has work
  const tasks = [];
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(64, now - last); last = now;
    for (const task of tasks) {
      try { task(now, dt); } catch (err) { console.error(err); }
    }
    pointer.moved = false; scroll.changed = false;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // wraps every word in .wd and every letter in .ch, keeping inline markup such as <em>
  function split(el) {
    if (el._chars && el.querySelector(".ch")) return el._chars;
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          if (!n.textContent) return;
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const w = document.createElement("span");
            w.className = "wd";
            for (const letter of part) {
              const c = document.createElement("span");
              c.className = "ch";
              c.textContent = letter;
              w.append(c);
              chars.push(c);
            }
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !/^(svg|img|small|br)$/i.test(n.tagName)) {
          walk(n);
        }
      });
    };
    walk(el);
    glue(el);
    el._chars = chars;
    return chars;
  }

  // every letter is now its own box, so a word touching markup with no space between
  // ("conversar<span>.</span>", "</em>.") could wrap apart; such neighbours share one nowrap box
  function glue(el) {
    [el, ...el.querySelectorAll("*")].forEach((parent) => {
      if (!(parent instanceof HTMLElement) || parent.matches(".wd, .ch, .nw, small")) return;
      let run = [];
      const flush = () => {
        if (run.length > 1 && run.some((n) => !n.classList.contains("wd"))) {
          const box = document.createElement("span");
          box.className = "nw";
          run[0].before(box);
          box.append(...run);
        }
        run = [];
      };
      [...parent.childNodes].forEach((n) => {
        if (n.nodeType === 1 && n.tagName !== "BR") run.push(n);
        else if (n.nodeType !== 3 || n.textContent) flush();
      });
      flush();
    });
  }

  return { root, reduce, fine, chromium, clamp, lerp, smooth, rand, spring, pointer, scroll, tasks, split };
})();
