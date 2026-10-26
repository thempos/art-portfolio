/* The painting stage. Michelangelo and Botticelli rendered in WebGL with canvas weave, craquelure,
   aged varnish and a gallery spotlight. The camera walks across the paintings as you change rooms,
   a loupe follows the mouse, taps send ripples, and the two works trade places through a gilded dissolve.
   Without WebGL2 the two <img> tags underneath simply cross-fade. */
(() => {
  const { reduce, fine, clamp, lerp, smooth, pointer, tasks } = TC;
  const stage = document.getElementById("stage");
  const imgs = [...stage.querySelectorAll(".fb img")];

  // ripples work in both modes; without WebGL they are simply ignored
  const ripples = [[0, 0, -1e9, 0], [0, 0, -1e9, 0], [0, 0, -1e9, 0]];
  let rip = 0;
  TC.ripple = (x, y, s = 1) => { if (reduce) return; ripples[rip] = [x, y, performance.now(), s]; rip = (rip + 1) % ripples.length; };
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button, input, .lg, .art, .name")) return;
    TC.ripple(e.clientX, e.clientY, e.pointerType === "mouse" ? 0.7 : 0.9);
  }, { passive: true });

  let flipped = false;
  const fallbackTimer = setInterval(() => { if (!document.hidden) stage.classList.toggle("flip", (flipped = !flipped)); }, 9000);

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
  if (!gl) return;

  const VS = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

  const FS = `#version 300 es
precision highp float;
uniform sampler2D uA, uB;
uniform vec2 uRes, uImgA, uImgB, uSpanA, uSpanB, uPar;
uniform float uDpr, uTime, uMix, uBlur, uDark, uSat, uLensR;
uniform vec4 uViewA, uViewB;
uniform vec3 uMouse, uLight;
uniform vec4 uRip[3];
out vec4 outColor;

const vec3 INK = vec3(0.059, 0.047, 0.063);
const vec3 GOLD = vec3(1.0, 0.74, 0.36);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
// distance to the nearest cell border: the network of cracks in old paint
float cracks(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + vec2(hash(i + g), hash(i + g + 31.7)) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
vec2 toImage(vec2 suv, vec4 view, vec2 span0) {
  vec2 span = span0 / view.z;
  vec2 f = clamp(view.xy + uPar, span * 0.5, 1.0 - span * 0.5);
  return f + vec2(suv.x - 0.5, 0.5 - suv.y) * span;
}
vec3 paint(sampler2D t, vec2 uv, vec2 img, vec2 span0, out float w) {
  vec3 c = texture(t, uv, uBlur).rgb;
  if (uBlur > 0.5) {
    vec2 o = exp2(uBlur) * 1.5 / img;
    c += texture(t, uv + vec2(o.x, o.y * 0.5), uBlur).rgb + texture(t, uv - vec2(o.x, -o.y * 0.5), uBlur).rgb
       + texture(t, uv + vec2(-o.x * 0.5, o.y), uBlur).rgb + texture(t, uv - vec2(-o.x * 0.5, o.y), uBlur).rgb;
    c *= 0.2;
  }
  vec2 cp = uv * (uRes / uDpr) / span0;          // css px across the painting at zoom 1
  vec2 ph = cp * 1.9635;                          // one thread every 3.2 px
  float over = step(0.0, sin(ph.x * 0.5) * sin(ph.y * 0.5));
  w = mix(sin(ph.x), sin(ph.y), over) * 0.5 + 0.5;
  float sharp = 1.0 - clamp(uBlur * 0.6, 0.0, 1.0);
  c *= 1.0 + (w - 0.5) * 0.08 * sharp;
  // craquelure: warped cells read as hairline cracks, only in patches, like real aged paint.
  // The patch mask is cheap and mostly zero, so the cell search runs only where cracks can show.
  float mask = smoothstep(0.55, 0.8, noise(cp / 300.0)) * sharp;
  if (mask > 0.001) {
    vec2 q = cp / 34.0;
    q += vec2(noise(q * 1.7), noise(q * 1.7 + 9.2)) * 0.55;
    float line = 1.0 - smoothstep(0.0, 0.035, cracks(q));
    c *= 1.0 - 0.16 * line * mask;
  }
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;

  // ripples
  vec2 disp = vec2(0.0);
  float crest = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 r = uRip[i];
    if (r.z < 0.0 || r.z > 2.6) continue;
    vec2 d = frag - r.xy;
    float dist = length(d);
    float x = (dist - r.z * 760.0 * uDpr) / (90.0 * uDpr);
    float env = exp(-x * x) * (1.0 - r.z / 2.6) * r.w;
    float wv = sin(x * 5.0) * env;
    disp += d / max(dist, 1.0) * wv * 16.0 * uDpr;
    crest += max(wv, 0.0);
  }

  // loupe
  vec2 dl = frag - uMouse.xy;
  float lr = length(dl) / uLensR;
  float inLens = (1.0 - smoothstep(0.985, 1.0, lr)) * uMouse.z;
  float rim = smoothstep(0.5, 1.0, lr);
  vec2 lens = (-dl * (1.0 - 1.0 / 1.8) * (1.0 - rim) + dl * rim * rim * 0.35) * inLens;
  vec2 suv = (frag + disp + lens) / uRes;

  vec3 cA = vec3(0.0), cB = vec3(0.0);
  float wA = 0.5, wB = 0.5;
  if (uMix < 0.998) cA = paint(uA, toImage(suv, uViewA, uSpanA), uImgA, uSpanA, wA);
  if (uMix > 0.002) cB = paint(uB, toImage(suv, uViewB, uSpanB), uImgB, uSpanB, wB);
  vec3 c; float w; float edge = 0.0;
  if (uMix <= 0.002) { c = cA; w = wA; }
  else if (uMix >= 0.998) { c = cB; w = wB; }
  else {
    float n = smoothstep(0.15, 0.85, fbm(vec2(suv.x * asp, suv.y) * 1.7 + vec2(uTime * 0.015, -uTime * 0.01)));
    float e = 0.05;
    float th = mix(-e, 1.0 + e, uMix);
    float a = smoothstep(th - e * 0.5, th + e * 0.5, n);
    c = mix(cB, cA, a);
    w = mix(wB, wA, a);
    edge = 1.0 - smoothstep(0.0, e, abs(n - th));
  }

  // prism fringe at the loupe rim
  if (inLens > 0.01 && rim > 0.01) {
    vec2 ca = dl / max(length(dl), 1.0) * rim * 5.0 * uDpr;
    vec2 s1 = (frag + disp + lens + ca) / uRes, s2 = (frag + disp + lens - ca) / uRes;
    bool useB = uMix > 0.5;
    // explicit lod: this branch is not uniform, so implicit derivatives are not reliable here
    float rr = useB ? textureLod(uB, toImage(s1, uViewB, uSpanB), uBlur).r : textureLod(uA, toImage(s1, uViewA, uSpanA), uBlur).r;
    float bb = useB ? textureLod(uB, toImage(s2, uViewB, uSpanB), uBlur).b : textureLod(uA, toImage(s2, uViewA, uSpanA), uBlur).b;
    c.r = mix(c.r, rr, rim * inLens * 0.8);
    c.b = mix(c.b, bb, rim * inLens * 0.8);
  }

  // grade: saturation, aged varnish, room darkness
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);
  c *= vec3(1.04, 1.0, 0.9);
  c = mix(c, INK, uDark);

  // gallery spotlight, with the weave catching light under it
  vec2 lp = (frag - uLight.xy) / uRes.y;
  float spot = exp(-dot(lp, lp) * 4.5) * uLight.z;
  c *= 0.82 + 0.32 * spot;
  c += vec3(1.0, 0.93, 0.8) * pow(w, 5.0) * spot * 0.07 * (1.0 - uDark);

  // gilded dissolve edge and ripple crests
  c += GOLD * (pow(edge, 3.0) * 0.55 + pow(edge, 14.0) * 0.7);
  c += GOLD * crest * 0.18;

  // loupe glass: lift, rim light, glint and a soft shadow on the canvas
  c = mix(c, c * 1.1 + 0.02, inLens * 0.6);
  float ring = smoothstep(0.9, 0.97, lr) * (1.0 - smoothstep(0.97, 1.0, lr));
  vec2 dn = dl / max(length(dl), 1.0);
  float glint = pow(max(dot(dn, normalize(vec2(-0.6, 0.8))), 0.0), 6.0) * smoothstep(0.75, 0.95, lr) * (1.0 - smoothstep(0.95, 1.0, lr));
  c += vec3(1.0, 0.97, 0.9) * (ring * 0.35 + glint * 0.6) * uMouse.z;
  float sd = length(dl + vec2(0.0, 12.0 * uDpr)) / uLensR;
  c *= 1.0 - 0.28 * (1.0 - smoothstep(1.0, 1.3, sd)) * step(1.0, lr) * uMouse.z;

  // vignette and grain; the grain holds still so an idle stage needs no new frames
  vec2 v = frag / uRes - 0.5;
  c *= 1.0 - dot(v * vec2(asp * 0.55, 1.0), v * vec2(asp * 0.55, 1.0)) * 0.6;
  c += (hash(frag) - 0.5) * 0.03;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn("Painting stage fell back to images:", err);
    return;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(aP);
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ["uA", "uB", "uRes", "uImgA", "uImgB", "uSpanA", "uSpanB", "uPar", "uDpr", "uTime", "uMix", "uBlur", "uDark", "uSat", "uLensR", "uViewA", "uViewB", "uMouse", "uLight", "uRip"]
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.uA, 0);
  gl.uniform1i(U.uB, 1);

  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  const tex = [];
  function upload(i, img) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    tex[i] = { w: img.naturalWidth, h: img.naturalHeight };
  }

  // camera per room, in image coordinates (0..1 from the top-left) with zoom; blur is in mip levels
  const rooms = [...document.querySelectorAll(".room")];
  const SHOTS = [
    { a: [0.4, 0.47, 1.0], b: [0.5, 0.4, 1.0], blur: 0, dark: 0.1, sat: 1.06 },      // the hands / Venus
    { a: [0.62, 0.27, 1.9], b: [0.5, 0.19, 2.1], blur: 1.1, dark: 0.42, sat: 1.1 },  // God's face / Venus' face
    { a: [0.42, 0.46, 1.35], b: [0.82, 0.34, 1.45], blur: 4.2, dark: 0.5, sat: 1.4 }, // a haze of colour
    { a: [0.13, 0.42, 1.7], b: [0.31, 0.27, 1.8], blur: 1.4, dark: 0.46, sat: 1.15 }, // Adam / Zephyr's wind
  ];
  const cam = { a: [...SHOTS[0].a], b: [...SHOTS[0].b], blur: 0, dark: SHOTS[0].dark, sat: SHOTS[0].sat };

  let dpr = 1, W = 1, H = 1, dirty = true;
  function resize() {
    W = stage.clientWidth || innerWidth;
    H = stage.clientHeight || innerHeight;
    dirty = true;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uDpr, dpr);
    if (tex.length === 2) {
      const ca = W / H;
      [[U.uSpanA, tex[0]], [U.uSpanB, tex[1]]].forEach(([u, t]) => {
        const ia = t.w / t.h;
        if (ca > ia) gl.uniform2f(u, 1, ia / ca); else gl.uniform2f(u, ca / ia, 1);
      });
    }
  }

  function roomTarget() {
    const c = innerHeight * 0.5;
    let f = 0;
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i].getBoundingClientRect();
      if (c < r.bottom || i === rooms.length - 1) { f = Math.min(rooms.length - 1, i + smooth(0.6, 1, (c - r.top) / r.height)); break; }
    }
    if (reduce) f = Math.round(f);
    const i = Math.floor(f), j = Math.min(SHOTS.length - 1, i + 1), t = f - i;
    const A = SHOTS[i], B = SHOTS[j];
    return {
      a: A.a.map((v, k) => lerp(v, B.a[k], t)), b: A.b.map((v, k) => lerp(v, B.b[k], t)),
      blur: lerp(A.blur, B.blur, t), dark: lerp(A.dark, B.dark, t), sat: lerp(A.sat, B.sat, t),
    };
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let mix = 0, mixFrom = 0, mixTo = 0, mixT0 = -1e9, nextSwap = 0, t0 = 0;
  const lens = { x: innerWidth / 2, y: innerHeight / 2, a: 0, r: 96 };
  const light = { x: innerWidth / 2, y: innerHeight * 0.3 };
  const par = { x: 0, y: 0 };
  const ripData = new Float32Array(12);
  let slow = 0, frames = 0, drawnMix = -1, drawnZoom = 0;

  // Every eased value lands exactly on its target, and a frame is drawn only when one of them moved.
  // A still stage then sends no new frames, so the glass above it has nothing to refilter.
  let moved = false;
  const approach = (v, t, k, eps) => {
    const n = Math.abs(t - v) < eps ? t : lerp(v, t, k);
    if (n !== v) moved = true;
    return n;
  };

  function frame(now, dt) {
    if (!t0) { t0 = now; nextSwap = now + 9000; }
    // adaptive resolution: if frames get slow, render fewer pixels
    frames++;
    slow = lerp(slow, dt, 0.05);
    if (frames > 90 && slow > 26 && dpr > 0.7) { dpr = Math.max(0.7, dpr * 0.8); resize(); frames = 0; }

    moved = dirty;
    const k = 1 - Math.exp(-dt / (reduce ? 1 : 260));
    const target = roomTarget();
    cam.a = cam.a.map((v, i) => approach(v, target.a[i], k, 1e-4));
    cam.b = cam.b.map((v, i) => approach(v, target.b[i], k, 1e-4));
    cam.blur = approach(cam.blur, target.blur, k, 1e-3);
    cam.dark = approach(cam.dark, target.dark, k, 1e-3);
    cam.sat = approach(cam.sat, target.sat, k, 1e-3);

    if (now > nextSwap) { mixFrom = mix; mixTo = mixTo > 0.5 ? 0 : 1; mixT0 = now; nextSwap = now + 9000; }
    const swapping = now - mixT0 < 3000;
    mix = lerp(mixFrom, mixTo, ease(clamp((now - mixT0) / 3000)));
    const zoom = reduce ? 1 : 1 + 0.16 * Math.pow(1 - clamp((now - t0) / 2800), 3);

    const wantLens = fine && !reduce && pointer.active && now - pointer.t < 2600;
    lens.a = approach(lens.a, wantLens ? (pointer.ui ? 0.35 : 1) : 0, 1 - Math.exp(-dt / 140), 1e-3);
    lens.r = approach(lens.r, pointer.ui ? 44 : 96, 1 - Math.exp(-dt / 160), 0.05);
    const kl = 1 - Math.exp(-dt / 60);
    lens.x = approach(lens.x, pointer.x, kl, 0.05);
    lens.y = approach(lens.y, pointer.y, kl, 0.05);

    // the spotlight follows the mouse; on touch screens it rests above the middle of the room
    const follow = fine && pointer.active;
    const kL = 1 - Math.exp(-dt / 220);
    light.x = approach(light.x, follow ? pointer.x : W * 0.5, kL, 0.1);
    light.y = approach(light.y, follow ? pointer.y : H * 0.3, kL, 0.1);
    par.x = approach(par.x, fine && !reduce ? (pointer.x / W - 0.5) * -0.014 : 0, kL, 1e-5);
    par.y = approach(par.y, fine && !reduce ? (pointer.y / H - 0.5) * -0.014 : 0, kL, 1e-5);

    // ripples keep drawing a little past their end so the last crest is cleared
    const rippling = ripples.some((r) => now - r[2] < 2800);
    if (!moved && !swapping && !rippling && mix === drawnMix && zoom === drawnZoom) return;
    dirty = false;
    drawnMix = mix;
    drawnZoom = zoom;

    ripples.forEach((r, i) => {
      ripData[i * 4] = r[0] * dpr;
      ripData[i * 4 + 1] = (H - r[1]) * dpr;
      ripData[i * 4 + 2] = (now - r[2]) / 1000;
      ripData[i * 4 + 3] = r[3];
    });

    gl.uniform1f(U.uTime, now / 1000);
    gl.uniform1f(U.uMix, mix);
    gl.uniform4f(U.uViewA, cam.a[0], cam.a[1], cam.a[2] * zoom, 0);
    gl.uniform4f(U.uViewB, cam.b[0], cam.b[1], cam.b[2] * zoom, 0);
    gl.uniform1f(U.uBlur, cam.blur);
    gl.uniform1f(U.uDark, cam.dark);
    gl.uniform1f(U.uSat, cam.sat);
    gl.uniform3f(U.uMouse, lens.x * dpr, (H - lens.y) * dpr, lens.a);
    gl.uniform1f(U.uLensR, lens.r * dpr);
    gl.uniform3f(U.uLight, light.x * dpr, (H - light.y) * dpr, 1);
    gl.uniform2f(U.uPar, par.x, par.y);
    gl.uniform4fv(U.uRip, ripData);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const ready = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
  Promise.all(imgs.map(ready)).then(() => {
    imgs.forEach((img, i) => upload(i, img));
    gl.uniform2f(U.uImgA, tex[0].w, tex[0].h);
    gl.uniform2f(U.uImgB, tex[1].w, tex[1].h);
    dpr = Math.min(window.devicePixelRatio || 1, fine ? 1.5 : 1.25);
    stage.append(canvas);
    resize();
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
    tasks.push(frame);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      stage.classList.add("gl");
      clearInterval(fallbackTimer);
    }));
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stage.classList.remove("gl"); });
  }).catch((err) => console.warn("Painting stage fell back to images:", err));
})();
