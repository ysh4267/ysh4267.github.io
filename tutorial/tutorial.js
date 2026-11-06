import { PAGES, SECTIONS, TOC } from './content.js?v=e123869de2';
import { figure, segmentPoints } from './figures.js?v=e123869de2';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const pad2 = (n) => String(n).padStart(2, '0');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const still = () => motionQuery.matches;
const SVG_NS = 'http://www.w3.org/2000/svg';

const body = document.body;
const stage = $('#stage');
const world = $('#world');
const fx = $('#fx');
const fxSvg = $('#fx-svg');
const sections = Object.fromEntries($$('[data-sec]').map((el) => [el.dataset.sec, el]));

/* ---------- 저장: 이 브라우저에만 남는다 ---------- */

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`hoon.tutorial.${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`hoon.tutorial.${key}`, JSON.stringify(value));
    } catch {
      // 저장이 막혀 있어도 화면은 그대로 동작한다.
    }
  },
};

/* ---------- 소리: 파일 없이 그 자리에서 합성한다 ---------- */

const sound = (() => {
  let ctx = null;
  let out = null;
  let noise = null;
  let on = store.get('audio', true);

  function ready() {
    if (!on) return null;
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      ctx = new Context();
      out = ctx.createGain();
      out.gain.value = 0.8;
      out.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx.state === 'running' ? ctx : null;
  }

  function envelope(gain, t, attack, peak, length) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  }

  function hiss({ length, peak, type = 'bandpass', from, to, q = 0.8 }) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + length);
    const gain = c.createGain();
    envelope(gain, t, Math.min(0.03, length / 4), peak, length);
    src.connect(filter).connect(gain).connect(out);
    src.start(t, Math.random() * 0.4);
    src.stop(t + length + 0.05);
  }

  function beep(freq, length, peak) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.frequency.value = freq;
    const gain = c.createGain();
    envelope(gain, t, 0.004, peak, length);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  return {
    get on() {
      return on;
    },
    set on(value) {
      on = value;
      store.set('audio', value);
      if (value) ready();
    },
    wake: ready,
    // 누를 때 나는 짧고 높은 삑 소리. 마우스를 올릴 때는 소리를 내지 않는다.
    click: () => beep(2400, 0.035, 0.018),
    whoosh: () => hiss({ length: 0.42, peak: 0.09, type: 'lowpass', from: 380, to: 2200 }),
  };
})();

/* ---------- 7세그먼트 표시 ---------- */

const DIGIT = { w: 20, h: 34, t: 3.9, advance: 25, gap: 9, colon: 9 };
const DIGIT_POINTS = segmentPoints(DIGIT.w, DIGIT.h, DIGIT.t, 0.75);
const SEG_ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
// 비트 k 가 SEG_ORDER[k] 조각이다.
const GLYPHS = { 0: 0b0111111, 1: 0b0000110, 2: 0b1011011, 3: 0b1001111, 4: 0b1100110, 5: 0b1101101, 6: 0b1111101, 7: 0b0000111, 8: 0b1111111, 9: 0b1101111, '-': 0b1000000 };

/** data-pattern 의 8 은 숫자 한 자리, : 은 콜론, 빈칸은 묶음 사이 간격이다. 돌려주는 함수에 자리 수만큼의 글자를 넘긴다. */
function makeSeg(host) {
  const parts = [];
  let x = 0;
  // data-dp 가 있으면 원본 상단 표시처럼 자리마다 꺼진 소수점이 붙는다.
  const dp = 'dp' in host.dataset ? `<circle class="s" cx="${DIGIT.w + 2.4}" cy="${DIGIT.h - 2}" r="1.8"/>` : '';
  for (const ch of host.dataset.pattern) {
    if (ch === '8') {
      parts.push(`<g class="d" transform="translate(${x} 0)">${SEG_ORDER.map((key) => `<polygon class="s" points="${DIGIT_POINTS[key]}"/>`).join('')}${dp}</g>`);
      x += DIGIT.advance;
    } else if (ch === ':') {
      const cx = x + 2;
      parts.push(`<circle class="s on" cx="${cx}" cy="${DIGIT.h * 0.3}" r="2.1"/><circle class="s on" cx="${cx}" cy="${DIGIT.h * 0.7}" r="2.1"/>`);
      x += DIGIT.colon;
    } else {
      x += DIGIT.gap;
    }
  }
  const width = x - (DIGIT.advance - DIGIT.w);
  host.innerHTML = `<svg viewBox="-6 -1 ${width + 8} ${DIGIT.h + 2}" aria-hidden="true"><g transform="skewX(-6)">${parts.join('')}</g></svg>`;
  const cells = $$('.d', host).map((g) => [...g.children]);
  let shown = null;
  return (text) => {
    if (text === shown) return;
    shown = text;
    cells.forEach((polys, i) => {
      const mask = GLYPHS[text[i]] ?? 0;
      polys.forEach((poly, k) => poly.classList.toggle('on', ((mask >> k) & 1) === 1));
    });
  };
}

const seg = Object.fromEntries($$('[data-seg]').map((host) => [host.dataset.seg, makeSeg(host)]));

/** 앞자리는 빈칸(꺼진 8)으로 채운다. 넘치면 뒷자리만 보인다. */
function digitsOf(value, count) {
  const text = String(Math.max(0, Math.floor(value)));
  return text.length > count ? text.slice(-count) : text.padStart(count, ' ');
}

/* ---------- 실시간 값 ---------- */

const live = {
  start: performance.now(),
  travel: store.get('travel', 0),
  wheel: store.get('wheel', 0),
  clicks: [],
  peak: 0,
  hovers: {},
  fps: 60,
  frames: 0,
  fpsAt: performance.now(),
  savedAt: 0,
};
const pointer = { x: 0, y: 0, seen: false, touch: false };
const motion = { samples: [], speed: 0, needle: -90 };

const spectrumBars = Array.from({ length: 12 }, () => document.createElement('i'));
$('#spectrum').append(...spectrumBars);
const spectrumLevels = spectrumBars.map(() => 0.15);
const healthBars = Array.from({ length: 12 }, () => document.createElement('i'));
$('#health-bar').append(...healthBars);
const healthPct = $('#health-pct');
const needle = $('#gauge-needle');
const fpsLampY = $('#fps-y');
const fpsLampG = $('#fps-g');
const rankNo = $('#rank-no');
const rankName = $('#rank-name');
const rankCount = $('#rank-count');
const utc = $('#utc');
const clockHands = { h: $('#clock-h'), m: $('#clock-m'), s: $('#clock-s') };

function svgLine(parent, cls, x1, y1, x2, y2) {
  const line = document.createElementNS(SVG_NS, 'line');
  if (cls) line.setAttribute('class', cls);
  line.setAttribute('x1', x1.toFixed(2));
  line.setAttribute('y1', y1.toFixed(2));
  line.setAttribute('x2', x2.toFixed(2));
  line.setAttribute('y2', y2.toFixed(2));
  parent.append(line);
}

// 속도계 눈금(왼쪽 0 에서 오른쪽 100 까지 반원)
for (let i = 0; i <= 10; i += 1) {
  const angle = Math.PI + (i / 10) * Math.PI;
  const major = i % 5 === 0;
  const inner = major ? 37 : 42;
  svgLine($('#gauge-ticks'), `g-tick${major ? ' major' : ''}`, Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * 49, Math.sin(angle) * 49);
}

/* ---------- 커서 스코프 ---------- */

const scope = { canvas: $('#scope'), ctx: null, bg: null, trail: [] };
scope.ctx = scope.canvas.getContext('2d');

function paintScopeBackground() {
  const { width: w, height: h } = scope.canvas;
  const bg = document.createElement('canvas');
  bg.width = w;
  bg.height = h;
  const g = bg.getContext('2d');
  const glow = g.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, w * 0.62);
  glow.addColorStop(0, '#10261a');
  glow.addColorStop(1, '#040806');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120, 255, 150, 0.08)';
  g.lineWidth = 1.5;
  for (let i = 1; i < 10; i += 1) {
    g.beginPath();
    g.moveTo((w / 10) * i, 48);
    g.lineTo((w / 10) * i, h);
    g.stroke();
  }
  for (let i = 1; i < 6; i += 1) {
    g.beginPath();
    g.moveTo(0, 48 + ((h - 48) / 6) * i);
    g.lineTo(w, 48 + ((h - 48) / 6) * i);
    g.stroke();
  }
  scope.bg = bg;
}
paintScopeBackground();

function pushTrail(now) {
  const trail = scope.trail;
  const x = clamp(pointer.x / Math.max(1, vp.w), 0, 1);
  const y = clamp(pointer.y / Math.max(1, vp.h), 0, 1);
  const last = trail[trail.length - 1];
  if (last && now - last.t < 40 && Math.hypot((x - last.x) * vp.w, (y - last.y) * vp.h) < 6) return;
  trail.push({ x, y, t: now });
  if (trail.length > 700) trail.shift();
}

function drawScope(now) {
  const { ctx, canvas, trail } = scope;
  const w = canvas.width;
  const h = canvas.height;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(scope.bg, 0, 0);
  while (trail.length && now - trail[0].t > 10000) trail.shift();
  const left = 34;
  const top = 62;
  const bottom = 24;
  const sx = (p) => left + p.x * (w - left * 2);
  const sy = (p) => top + p.y * (h - top - bottom);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass += 1) {
    ctx.lineWidth = pass ? 3.2 : 11;
    for (let i = 1; i < trail.length; i += 1) {
      const a = trail[i - 1];
      const b = trail[i];
      if (b.t - a.t > 400) continue;
      const life = 1 - (now - b.t) / 10000;
      ctx.strokeStyle = pass ? `rgba(160, 255, 170, ${(life ** 1.4 * 0.95).toFixed(3)})` : `rgba(60, 255, 110, ${(life ** 2 * 0.11).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(sx(a), sy(a));
      ctx.lineTo(sx(b), sy(b));
      ctx.stroke();
    }
  }
  const head = trail[trail.length - 1];
  if (head && now - head.t < 10000) {
    const fade = 1 - (now - head.t) / 10000;
    const dot = ctx.createRadialGradient(sx(head), sy(head), 0, sx(head), sy(head), 16);
    dot.addColorStop(0, `rgba(220, 255, 220, ${fade.toFixed(3)})`);
    dot.addColorStop(1, 'rgba(60, 255, 110, 0)');
    ctx.fillStyle = dot;
    ctx.fillRect(sx(head) - 16, sy(head) - 16, 32, 32);
  }
  // 아무것도 없을 때도 화면이 살아 있도록 주사선 하나가 천천히 내려간다.
  const sweep = top + ((now / 24) % (h - top - bottom));
  ctx.fillStyle = 'rgba(120, 255, 140, 0.06)';
  ctx.fillRect(0, sweep, w, 3);
}

function updateMotion(now, dt) {
  while (motion.samples.length && now - motion.samples[0].t > 160) motion.samples.shift();
  let distance = 0;
  for (const sample of motion.samples) distance += sample.d;
  motion.speed += (distance / 0.16 - motion.speed) * (1 - Math.exp(-dt / 140));
  const value = clamp(motion.speed / 30, 0, 100);
  motion.needle += ((value - 50) * 1.8 - motion.needle) * (1 - Math.exp(-dt / 160));
  needle.setAttribute('transform', `rotate(${motion.needle.toFixed(2)})`);

  let recent = 0;
  for (let i = live.clicks.length - 1; i >= 0 && now - live.clicks[i] < 1500; i -= 1) recent += 1;
  const energy = clamp(motion.speed / 1600 + recent * 0.25, 0, 1);
  const k = 1 - Math.exp(-dt / 70);
  spectrumBars.forEach((bar, i) => {
    const wave = 0.5 + 0.5 * Math.sin(now * 0.006 * (0.7 + i * 0.13) + i * 1.7);
    const target = 0.08 + 0.16 * wave + energy * (0.3 + 0.6 * Math.random());
    spectrumLevels[i] += (target - spectrumLevels[i]) * k;
    bar.style.transform = `scaleY(${clamp(spectrumLevels[i], 0.05, 1).toFixed(3)})`;
  });
}

let rankStep = -1;
let rankAt = -Infinity;
function updateRank(now) {
  if (now - rankAt < 3000) return;
  rankAt = now;
  const entries = Object.entries(live.hovers).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (entries.length === 0) {
    rankNo.textContent = '#01';
    rankName.textContent = '-----';
    rankCount.textContent = '0 HOVERS';
    return;
  }
  rankStep = (rankStep + 1) % entries.length;
  const [id, count] = entries[rankStep];
  rankNo.textContent = `#${pad2(rankStep + 1)}`;
  rankName.textContent = SECTIONS[id].name;
  rankCount.textContent = `${count} HOVER${count === 1 ? '' : 'S'}`;
}

function updateDisplays(now) {
  seg.travel(digitsOf(live.travel, 14));
  const secs = Math.floor((now - live.start) / 1000);
  seg.session(`${pad2(Math.floor(secs / 3600) % 100)}${pad2(Math.floor(secs / 60) % 60)}${pad2(secs % 60)}`);
  while (live.clicks.length && now - live.clicks[0] > 60000) live.clicks.shift();
  live.peak = Math.max(live.peak, live.clicks.length);
  seg.cpm(digitsOf(live.clicks.length, 6));
  seg.peak(digitsOf(live.peak, 6));
  const d = new Date();
  seg.local(`${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`);
  seg.wheel(digitsOf(live.wheel, 10));
  const fps = Math.round(live.fps);
  seg.fps(digitsOf(fps, 6));
  fpsLampY.classList.toggle('on', fps < 45);
  fpsLampG.classList.toggle('on', fps >= 45);
  const lit = clamp(Math.round(fps / 5), 0, 12);
  healthBars.forEach((bar, i) => bar.classList.toggle('on', i < lit));
  healthPct.textContent = fps >= 58 ? '>99.99%' : `${clamp((fps / 60) * 100, 0, 99.99).toFixed(2)}%`;
  utc.textContent = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`;
  const hours = (d.getHours() % 12) + d.getMinutes() / 60;
  clockHands.h.setAttribute('transform', `rotate(${(hours * 30).toFixed(1)})`);
  clockHands.m.setAttribute('transform', `rotate(${(d.getMinutes() * 6 + d.getSeconds() * 0.1).toFixed(1)})`);
  clockHands.s.setAttribute('transform', `rotate(${d.getSeconds() * 6})`);
  updateRank(now);
  if (now - live.savedAt > 2000) {
    live.savedAt = now;
    store.set('travel', Math.floor(live.travel));
    store.set('wheel', Math.floor(live.wheel));
  }
}

/* ---------- 인쇄기와 영수증 ---------- */

const rollLines = $('#roll-lines');
const lamps = [$('#lamp-a'), $('#lamp-b')];
const ROLL_LINE = 24;
let lastLog = { key: '', at: 0 };

/** 원본 영수증처럼 작은 설명 줄 아래에 큰 값을 오른쪽 정렬로 찍는다. */
function printEntry(caption, value, cls = '') {
  const entry = document.createElement('div');
  entry.className = cls ? `entry ${cls}` : 'entry';
  const small = document.createElement('small');
  small.textContent = caption;
  const big = document.createElement('b');
  big.textContent = value;
  entry.append(small, big);
  rollLines.prepend(entry);
  while (rollLines.children.length > 32) rollLines.lastElementChild.remove();
}

/** 새 줄은 늘 투입구 바로 아래(맨 위)에 찍히고, 종이가 한 칸만큼 밀려 나온다. */
function log(verb, subject) {
  const now = performance.now();
  const key = `${verb} ${subject}`;
  if (key === lastLog.key && now - lastLog.at < 700) return;
  lastLog = { key, at: now };
  const d = new Date();
  printEntry(`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}  ${verb}`, subject);
  if (!still()) {
    rollLines.animate([{ transform: `translateY(${-ROLL_LINE}px)` }, { transform: 'translateY(0)' }], { duration: 280, easing: 'cubic-bezier(.3,.7,.3,1)' });
  }
  lamps.forEach((lamp, i) => {
    lamp.classList.add('on');
    clearTimeout(lamp.offTimer);
    lamp.offTimer = setTimeout(() => lamp.classList.remove('on'), 170 + i * 170);
  });
}

/* ---------- 카메라 ---------- */

// 기본 화면에 담는 장면 범위(세계 좌표). 레퍼런스 영상의 기본 화면(16:9)과 같은 구도다.
const HOME = { x: 75, y: 109, w: 1446, h: 815 };
// 설명서를 펼친 채 특정 섹션이 없는 페이지(표지, 차례 등)에서 남은 공간에 담는 범위.
const OVERVIEW = { x: 236, y: 118, w: 1128, h: 806 };
// 세로로 긴 화면(휴대폰)에서는 원본 구도로는 기계가 너무 작아서 기계 위주로 담는다.
const PORTRAIT = { x: 300, y: 160, w: 1000, h: 760 };
const HUD_GAP = 50;
const vp = { w: window.innerWidth, h: window.innerHeight };
const cam = { x: 800, y: 574, s: 1 };
let camTween = null;

function measure() {
  vp.w = stage.clientWidth || window.innerWidth;
  vp.h = stage.clientHeight || window.innerHeight;
}

function applyCamera() {
  const tx = vp.w / 2 - cam.x * cam.s;
  const ty = vp.h / 2 - cam.y * cam.s;
  world.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${cam.s.toFixed(5)})`;
}

const toScreenX = (wx) => vp.w / 2 + (wx - cam.x) * cam.s;

function worldRectOf(el) {
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - vp.w / 2) / cam.s + cam.x,
    y: (r.top - vp.h / 2) / cam.s + cam.y,
    w: r.width / cam.s,
    h: r.height / cam.s,
  };
}

/** 세계 좌표의 rect 를 화면의 area 안에 맞춰 보여 주는 카메라 값. */
function frameRect(rect, area, maxScale = Infinity) {
  const s = Math.min(area.w / rect.w, area.h / rect.h, maxScale);
  return {
    s,
    x: rect.x + rect.w / 2 - (area.x + area.w / 2 - vp.w / 2) / s,
    y: rect.y + rect.h / 2 - (area.y + area.h / 2 - vp.h / 2) / s,
  };
}

function cameraArea() {
  if (manual.open && manual.box) {
    if (manual.layout === 'side') return { x: 14, y: HUD_GAP, w: Math.max(120, manual.box.left - 28), h: vp.h - HUD_GAP * 2 };
    return { x: 14, y: HUD_GAP, w: vp.w - 28, h: Math.max(100, manual.box.top - HUD_GAP - 12) };
  }
  // 원본처럼 장면이 화면 전체를 채우고, 버튼 줄은 그 위에 떠 있다.
  return { x: 0, y: 0, w: vp.w, h: vp.h };
}

function focusRect(id) {
  const r = worldRectOf(sections[id]);
  const pad = clamp(Math.min(r.w, r.h) * 0.9, 70, 150);
  let x = r.x - pad;
  let y = r.y - pad;
  let w = r.w + pad * 2;
  let h = r.h + pad * 2;
  if (w < 440) {
    x -= (440 - w) / 2;
    w = 440;
  }
  if (h < 300) {
    y -= (300 - h) / 2;
    h = 300;
  }
  return { x, y, w, h };
}

function cameraTarget() {
  const area = cameraArea();
  const page = PAGES[manual.index];
  if (!manual.open) return frameRect(vp.w < vp.h ? PORTRAIT : HOME, area);
  if (!page.sec) return frameRect(OVERVIEW, area);
  const maxScale = frameRect(HOME, { x: 0, y: 0, w: vp.w, h: vp.h }).s * 2.6;
  return frameRect(focusRect(page.sec), area, maxScale);
}

function moveCamera(target, duration = 1150) {
  if (duration <= 0 || still()) {
    Object.assign(cam, { x: target.x, y: target.y, s: target.s });
    camTween = null;
    world.style.willChange = '';
    applyCamera();
    return;
  }
  camTween = { from: { ...cam }, to: target, start: performance.now(), duration };
  world.style.willChange = 'transform';
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function stepCamera(now) {
  if (!camTween) return false;
  const { from, to, start, duration } = camTween;
  const t = clamp((now - start) / duration, 0, 1);
  const e = easeInOutCubic(t);
  cam.s = Math.exp(lerp(Math.log(from.s), Math.log(to.s), e));
  cam.x = lerp(from.x, to.x, e);
  cam.y = lerp(from.y, to.y, e);
  applyCamera();
  if (t >= 1) {
    camTween = null;
    // 다 움직인 뒤에 새 배율로 다시 그려 글자가 또렷해진다.
    world.style.willChange = '';
  }
  return true;
}

/* ---------- 강조 테두리 ---------- */

const HL_PAD = 3;
const highlights = new Set();

function placeHighlight(hl) {
  const r = hl.target.getBoundingClientRect();
  const style = hl.el.style;
  style.transform = `translate(${(r.left - HL_PAD).toFixed(1)}px, ${(r.top - HL_PAD).toFixed(1)}px)`;
  style.width = `${(r.width + HL_PAD * 2).toFixed(1)}px`;
  style.height = `${(r.height + HL_PAD * 2).toFixed(1)}px`;
}

function addHighlight(target) {
  const el = document.createElement('div');
  el.className = 'hl';
  fx.append(el);
  const hl = { el, target, dying: false };
  highlights.add(hl);
  placeHighlight(hl);
  void el.offsetWidth;
  el.classList.add('on');
  return hl;
}

function dropHighlight(hl) {
  if (!hl || hl.dying) return;
  hl.dying = true;
  hl.el.classList.remove('on');
  setTimeout(() => {
    hl.el.remove();
    highlights.delete(hl);
  }, 320);
}

/* ---------- 팝업 ---------- */

const POP = { gapY: 24, overlap: 16, edge: 10, hud: 46 };
const pops = [];

function makePop() {
  const el = document.createElement('div');
  el.className = 'pop';
  el.innerHTML = '<i class="cx tl"></i><i class="cx tr"></i><i class="cx bl"></i><i class="cx br"></i>'
    + '<div class="pop-head"><span class="pop-kind"><span class="k"></span><span class="pop-num"></span></span><span class="pop-title"></span></div>'
    + '<div class="pop-body"></div>';
  fx.append(el);
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('class', 'leader');
  line.setAttribute('visibility', 'hidden');
  fxSvg.append(line);
  const pop = {
    el,
    line,
    anchor: null,
    side: 'r',
    below: false,
    prefer: null,
    follow: true,
    scene: true,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    rx: 0,
    ry: 0,
    anims: [],
    parts: { kind: $('.k', el), num: $('.pop-num', el), title: $('.pop-title', el), text: $('.pop-body', el) },
  };
  pops.push(pop);
  return pop;
}

/** 장면 팝업은 펼친 설명서를 덮지 않도록, 설명서 옆(또는 위)의 남은 화면 안에만 둔다. */
function popBounds(pop) {
  const bounds = { right: vp.w - POP.edge, bottom: vp.h - POP.hud + 8 };
  if (pop.scene && manual.open && manual.box) {
    if (manual.layout === 'side') bounds.right = Math.min(bounds.right, manual.box.left - POP.edge);
    else bounds.bottom = Math.min(bounds.bottom, manual.box.top - POP.edge);
  }
  return bounds;
}

/** 팝업은 대상의 위쪽 모서리 바깥에 대각선으로 붙는다. 처음 놓일 쪽을 정하고, 보이는 동안은 그 쪽을 지킨다. */
function chooseSide(pop, r) {
  const bounds = popBounds(pop);
  let side = pop.prefer ?? (r.left + r.width / 2 < toScreenX(800) ? 'l' : 'r');
  const fitsLeft = r.left + POP.overlap - pop.w >= POP.edge;
  const fitsRight = r.right - POP.overlap + pop.w <= bounds.right;
  if (side === 'l' && !fitsLeft && fitsRight) side = 'r';
  else if (side === 'r' && !fitsRight && fitsLeft) side = 'l';
  let below = r.top - POP.gapY - pop.h < POP.hud;
  if (below && r.bottom + POP.gapY + pop.h > bounds.bottom) below = false;
  pop.side = side;
  pop.below = below;
  // 대상과 이어진 모서리(연결선이 닿는 쪽)를 축으로 3D 회전한다. 그 모서리는 제자리에 있고 반대쪽이 앞뒤로 움직인다.
  pop.el.style.transformOrigin = `${side === 'r' ? '0%' : '100%'} ${below ? '0%' : '100%'}`;
}

// 레퍼런스 영상에서 잰 값: 원근 약 800px, 커서가 대상 가장자리에 있을 때 좌우 6.5도, 위아래 7.5도.
// (영상 6.7초: 오른쪽 변/왼쪽 변 1.033, 아랫변/윗변 1.010. 7.3초: 왼쪽/오른쪽 1.019)
const POP_TILT = { perspective: 800, y: 6.5, x: 7.5 };

/** 커서가 대상 중심에서 벗어난 쪽을 팝업이 바라보도록 기울인다. */
function popTilt(pop, r) {
  if (!pop.follow || !pointer.seen) return { rx: 0, ry: 0 };
  const nx = clamp((pointer.x - (r.left + r.width / 2)) / Math.max(1, r.width / 2), -1, 1);
  const ny = clamp((pointer.y - (r.top + r.height / 2)) / Math.max(1, r.height / 2), -1, 1);
  return { rx: -POP_TILT.x * ny, ry: POP_TILT.y * nx };
}

function popTarget(pop, r) {
  let x = pop.side === 'r' ? r.right - POP.overlap : r.left + POP.overlap - pop.w;
  let y = pop.below ? r.bottom + POP.gapY : r.top - POP.gapY - pop.h;
  if (pop.follow && pointer.seen) {
    // 포인터를 따라 살짝 끌려간다(커서가 움직인 거리의 약 10%).
    x += clamp((pointer.x - (r.left + r.width / 2)) * 0.1, -24, 24);
    y += clamp((pointer.y - (r.top + r.height / 2)) * 0.04, -8, 8);
  }
  const bounds = popBounds(pop);
  return {
    x: clamp(x, POP.edge, Math.max(POP.edge, bounds.right - pop.w)),
    y: clamp(y, POP.hud - 8, Math.max(POP.hud - 8, bounds.bottom - pop.h)),
  };
}

function placePop(pop, r) {
  pop.el.style.transform = `translate(${pop.x.toFixed(1)}px, ${pop.y.toFixed(1)}px) perspective(${POP_TILT.perspective}px) rotateX(${pop.rx.toFixed(2)}deg) rotateY(${pop.ry.toFixed(2)}deg)`;
  // 대상 모서리에서 팝업 아래(또는 위) 변까지 비스듬히 잇는 선.
  const cx = pop.side === 'r' ? r.right + HL_PAD : r.left - HL_PAD;
  const cy = pop.below ? r.bottom + HL_PAD : r.top - HL_PAD;
  const edgeY = pop.below ? pop.y : pop.y + pop.h;
  const gap = pop.below ? edgeY - cy : cy - edgeY;
  if (gap < 4) {
    pop.line.setAttribute('visibility', 'hidden');
    return;
  }
  const ex = clamp(pop.side === 'r' ? cx + gap * 2 : cx - gap * 2, pop.x + 8, pop.x + pop.w - 8);
  pop.line.setAttribute('x1', cx.toFixed(1));
  pop.line.setAttribute('y1', cy.toFixed(1));
  pop.line.setAttribute('x2', ex.toFixed(1));
  pop.line.setAttribute('y2', edgeY.toFixed(1));
  pop.line.setAttribute('visibility', 'visible');
}

function showPop(pop, anchor, info) {
  for (const anim of pop.anims) anim.cancel();
  pop.anims = [];
  pop.parts.kind.textContent = info.kind;
  pop.parts.num.textContent = info.num;
  pop.parts.title.textContent = info.title;
  pop.parts.text.textContent = info.text;
  pop.anchor = anchor;
  pop.prefer = info.side ?? null;
  pop.follow = info.follow ?? true;
  pop.scene = info.scene ?? true;
  pop.el.classList.add('on');
  pop.w = pop.el.offsetWidth;
  pop.h = pop.el.offsetHeight;
  const r = anchor.getBoundingClientRect();
  chooseSide(pop, r);
  Object.assign(pop, popTarget(pop, r), popTilt(pop, r));
  placePop(pop, r);
  if (still()) return;
  // 흐릿하게 번진 채 밝게 나타났다가 곧 또렷해진다.
  pop.anims.push(pop.el.animate([
    { opacity: 0, filter: 'blur(14px) brightness(2.2)' },
    { opacity: 0.55, filter: 'blur(6px) brightness(1.6)', offset: 0.35 },
    { opacity: 0.92, filter: 'blur(1.5px) brightness(1.15)', offset: 0.7 },
    { opacity: 1, filter: 'blur(0px) brightness(1)' },
  ], { duration: 240, easing: 'cubic-bezier(.25,.6,.3,1)' }));
  pop.anims.push(pop.line.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: 240 }));
}

function hidePop(pop) {
  for (const anim of pop.anims) anim.cancel();
  pop.anims = [];
  pop.anchor = null;
  pop.el.classList.remove('on');
  pop.line.setAttribute('visibility', 'hidden');
}

function updatePops(dt) {
  const k = 1 - Math.exp(-dt / 110);
  for (const pop of pops) {
    if (!pop.anchor) continue;
    const r = pop.anchor.getBoundingClientRect();
    const target = popTarget(pop, r);
    const tilt = popTilt(pop, r);
    pop.x += (target.x - pop.x) * k;
    pop.y += (target.y - pop.y) * k;
    pop.rx += (tilt.rx - pop.rx) * k;
    pop.ry += (tilt.ry - pop.ry) * k;
    placePop(pop, r);
  }
}

const mainPop = makePop();
const infoPop = makePop();

/* ---------- 마우스를 올린 부분 ---------- */

let hover = null;
let pageHighlight = null;

function sectionInfo(id) {
  const sec = SECTIONS[id];
  return sec.link
    ? { kind: 'LINK', num: pad2(sec.link), title: sec.title, text: sec.text, side: sec.side }
    : { kind: 'PAGE', num: pad2(sec.page), title: sec.title, text: sec.text, side: sec.side };
}

function setHover(el) {
  if (el === (hover?.el ?? null)) return;
  if (hover) {
    dropHighlight(hover.hl);
    hidePop(mainPop);
    hover = null;
  }
  if (!el || body.classList.contains('booting')) return;
  const id = el.dataset.sec;
  hover = { el, id, hl: pageHighlight?.target === el ? null : addHighlight(el) };
  showPop(mainPop, el, sectionInfo(id));
  live.hovers[id] = (live.hovers[id] ?? 0) + 1;
  log('HOVER', SECTIONS[id].name);
}

function sectionAt(x, y) {
  return document.elementFromPoint(x, y)?.closest?.('[data-sec]') ?? null;
}

function activate(el, event) {
  const sec = SECTIONS[el.dataset.sec];
  log('CLICK', sec.name);
  if (sec.link) return; // 링크는 새 탭에서 스스로 열린다.
  event?.preventDefault();
  sound.click();
  openManual(sec.page);
}

/* ---------- 설명서 ---------- */

const BOOK = { w: 560, h: 940 };
const FLIP_MS = 1150;
const manual = {
  open: false,
  index: 0,
  fly: null,
  box: null,
  layout: 'side',
  root: $('#manual'),
  pos: $('#manual-pos'),
  flyEl: $('#manual-fly'),
  book: $('#book'),
  book3d: $('#book-3d'),
  rings: $('#rings'),
};
for (let i = 0; i < 24; i += 1) manual.rings.append(document.createElement('i'));

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (text) => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const LOGO = '<span class="pg-logo"><b>HOON</b><small>HUMAN-OPERATED<br>OBSERVATION NODE</small></span>';
const pageNo = (index) => `<span class="pg-no">PAGE <b>${pad2(index)}</b></span>`;
const titleBar = (title) => `<header class="pg-title"><h2>${esc(title)}</h2><i></i></header>`;
const figBox = ({ id, kind, caption }) => `<figure class="fig"><div class="fig-tag"><span>FIG. <b>${esc(id)}</b></span></div>${figure(kind)}<figcaption class="fig-cap">${esc(caption)}</figcaption></figure>`;

function scallopPath(cx, cy, r, bumps, depth) {
  const steps = bumps * 12;
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r + depth * Math.cos(a * bumps);
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }
  return `${d}Z`;
}

const STICKER = `<div class="sticker" data-reboot role="button" tabindex="0" aria-label="Reboot the machine"><svg viewBox="0 0 156 156" aria-hidden="true">`
  + '<defs><path id="sticker-ring" d="M78 78m-55 0a55 55 0 1 1 110 0a55 55 0 1 1-110 0"/></defs>'
  + `<g class="spin"><path class="face" d="${scallopPath(78, 78, 74, 26, 3)}"/>`
  + '<text class="ring-text"><textPath href="#sticker-ring" textLength="340" lengthAdjust="spacing">CLICK TO REBOOT &#183; CLICK TO REBOOT &#183; </textPath></text></g>'
  + '<circle class="core" cx="78" cy="78" r="39"/>'
  + '<text class="core-text" x="78" y="70">CLICK</text><text class="core-text small" x="78" y="83">TO</text><text class="core-text" x="78" y="100">REBOOT</text>'
  + '</svg></div>';

function tocLink(n) {
  const sub = PAGES[n].sec === 'roll' ? ' sub' : '';
  return `<a class="toc-link${sub}" href="#page-${n}" data-goto="${n}"><span class="t">${esc(PAGES[n].title)}</span><span class="dots"></span><span class="n">${pad2(n)}</span></a>`;
}

const TEMPLATES = {
  cover: () => '<p class="cover-banner">CONGRATULATIONS ON YOUR PURCHASE</p>'
    + '<div class="cover-brand"><h1>HOON</h1><span>MK I</span></div>'
    + '<p class="cover-sub">HUMAN-OPERATED OBSERVATION NODE <em>MARK ONE</em></p>'
    + `<figure class="fig cover-fig"><div class="fig-tag"><span>FIG. <b>00</b></span><span>GENERAL ARRANGEMENT</span></div>${figure('iso')}</figure>`
    + '<div class="cover-warn"><span>PLEASE BE AWARE THAT ALL</span><span>DATA DISPLAYED ARE THE</span><span>NEAREST APPROXIMATIONS</span></div>'
    + '<p class="cover-fine">REFER BACK TO YOUR MACHINE OFTEN. IT IS WATCHING YOU, POLITELY.</p>'
    + `<footer class="pg-foot center">${LOGO}</footer>`,
  notes: (page, index) => `${titleBar(page.title)}${figBox(page.fig)}`
    + '<p class="pg-body">DATA CAPTURES ACTIVITY:</p>'
    + '<p class="pg-body">FROM<br>&rarr; THE MOMENT THIS PAGE WAS OPENED</p>'
    + '<p class="pg-body">TO<br>&rarr; THE MOMENT YOU CLOSE IT</p>'
    + '<p class="note">NOTHING YOU DO HERE LEAVES THIS BROWSER. ONLY TWO TOTALS, CURSOR TRAVEL AND WHEEL TRAVEL, ARE REMEMBERED, AND ONLY ON THIS DEVICE.</p>'
    + '<p class="pg-body small"><b>ADDITIONAL NOTES:</b></p>'
    + '<p class="pg-body small">THE <b>HOON MK I</b> SHOWS WHAT A VISITOR LOOKS LIKE FROM THE OTHER SIDE OF THE SCREEN: A FEW HUNDRED NUMBERS A SECOND. HOVER ANY MODULE TO READ ITS LABEL, OR CLICK IT TO TURN STRAIGHT TO ITS PAGE.</p>'
    + `<footer class="pg-foot">${LOGO}${pageNo(index)}</footer>`,
  toc: (page, index) => titleBar(page.title)
    + '<p class="toc-intro">EVERY <b>HOON MK I</b> COMPRISES TWELVE DISTINCT MODULES, EACH READING LIVE DATA FROM THE VISITOR IN FRONT OF IT. TOGETHER, THEY FORM THE FINEST CURSOR-WATCHING INSTRUMENT EVER BOLTED TO A DESK.</p>'
    + `<nav class="toc">${TOC.map((group) => `<div class="toc-group">${group.map(tocLink).join('')}</div>`).join('')}</nav>`
    + `<footer class="pg-foot">${LOGO}${pageNo(index)}</footer>`,
  section: (page, index) => titleBar(page.title)
    + `<p class="pg-body">${rich(page.body)}</p>`
    + figBox(page.fig)
    + (page.body2 ? `<p class="pg-body">${rich(page.body2)}</p>` : '')
    + (page.specs ? `<dl class="specs">${page.specs.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>` : '')
    + (page.note ? `<p class="note">${rich(page.note)}</p>` : '')
    + `<footer class="pg-foot">${LOGO}${pageNo(index)}</footer>`,
  end: (page, index) => titleBar(page.title)
    + '<div class="owner-box"><b>A FINAL WORD</b><p>WE HOPE BY NOW YOU FEEL CONFIDENT IN OPERATING YOUR NEW <b>HOON MK I</b>. THE WORLD OF POINTER INFRASTRUCTURE IS AT YOUR FINGERTIPS.</p></div>'
    + '<p class="pg-body"><b>HOON</b> IS A SMALL WEBSITE THAT KEEPS A HANDFUL OF GAMES AND TOOLS IN ONE PLACE. THIS MACHINE IS ONE OF THEM.</p>'
    + '<p class="pg-body">THE CONTENTS OF THIS PUBLICATION MAY BE REPRODUCED, REBROADCAST OR READ ALOUD TO HOUSEPLANTS WITHOUT ANY CONSENT AT ALL.</p>'
    + '<p class="note">THE NAME "MK I" SUGGESTS A "MK II". NO SUCH MACHINE IS PLANNED, BUT IT HAS NOT BEEN RULED OUT EITHER. TO START OVER, PRESS THE ORANGE STICKER.</p>'
    + '<div class="reg-card"><b>OWNER REGISTRATION CARD</b><dl>'
    + '<dt>OWNER</dt><dd>&nbsp;</dd>'
    + `<dt>DATE</dt><dd>${new Date().toISOString().slice(0, 10)}</dd>`
    + '<dt>SERIAL NO.</dt><dd>07-07-07</dd>'
    + '<dt>SIGNATURE</dt><dd>&nbsp;</dd>'
    + '</dl><small>NO NEED TO MAIL THIS CARD. THE MACHINE ALREADY KNOWS YOU ARE HERE.</small></div>'
    + STICKER
    + `<footer class="pg-foot">${LOGO}${pageNo(index)}</footer>`,
};

const pageEls = PAGES.map((page, index) => {
  const el = document.createElement('article');
  const kind = page.kind ?? 'section';
  el.className = `page page-${kind}`;
  el.hidden = true;
  el.innerHTML = TEMPLATES[kind](page, index);
  const shade = document.createElement('i');
  shade.className = 'shade';
  el.append(shade);
  manual.book3d.insertBefore(el, manual.rings);
  return el;
});

function layoutBook() {
  const top = 50;
  const bottom = 54;
  const portrait = vp.w < 760 && vp.h > vp.w * 1.05;
  let scale;
  let left;
  let topPx;
  if (portrait) {
    scale = Math.min((vp.h * 0.6) / BOOK.h, (vp.w - 40) / BOOK.w);
    left = (vp.w - BOOK.w * scale) / 2 + 8;
    topPx = vp.h - bottom - BOOK.h * scale;
  } else {
    scale = Math.min((vp.h - top - bottom) / BOOK.h, (vp.w * 0.46) / BOOK.w);
    left = vp.w - 12 - BOOK.w * scale;
    topPx = top + (vp.h - top - bottom - BOOK.h * scale) / 2;
  }
  manual.pos.style.transform = `translate(${left.toFixed(1)}px, ${topPx.toFixed(1)}px) scale(${scale.toFixed(4)})`;
  manual.box = { left, top: topPx, right: left + BOOK.w * scale, bottom: topPx + BOOK.h * scale, scale };
  // 화면 가운데에서 책을 바라보는 원근. 책이 오른쪽에 있으면 넘어가는 페이지를 왼쪽에서 비스듬히 보게 된다.
  const ox = clamp((vp.w / 2 - left) / scale, -BOOK.w, BOOK.w * 2);
  const oy = clamp((vp.h / 2 - topPx) / scale, 0, BOOK.h);
  manual.book.style.perspectiveOrigin = `${ox.toFixed(0)}px ${oy.toFixed(0)}px`;
  manual.layout = portrait ? 'bottom' : 'side';
}

function showOnly(index) {
  pageEls.forEach((el, i) => {
    el.hidden = i !== index;
    el.classList.remove('under', 'turning');
  });
}

/* ---------- 페이지 넘김: 접히는 선과 나란한 띠로 잘라 휘게 한다 ----------
   비스듬히 끌면 접히는 선도 기울어 모서리부터 사선으로 말린다. 스프링 쪽이 들리기 전에 기울기는 0 으로 돌아온다.
   레퍼런스 영상(13.3~14.7초)을 따른다. 잡은 쪽 끝이 먼저 말려 올라가 안쪽으로 접히는 동안 스프링 쪽은 누워 있고,
   접힌 자리가 스프링 쪽에 다가오면 스프링 쪽이 들리며 페이지가 크게 휜 채 왼쪽으로 넘어간다.
   왼쪽에 잠깐 머물렀다가 책 뒤로 감긴다. 되돌릴 때는 같은 모양을 거꾸로 밟으며 오른쪽에 펼쳐진다.
   페이지를 잡고 끌면 이 과정을 손으로 조절한다.
   자세는 네 값이다. hinge: 스프링 쪽 각도, roll: 휘기 시작하는 자리, span: 휘는 구간의 길이(둘 다 페이지 폭 비율),
   bend: 휘는 구간에서 더 도는 각도. 각도는 도 단위이고 0 은 오른쪽에 평평, 180 은 왼쪽에 평평이다. */
const CURL = {
  arcStrips: 24,
  seam: 0.6,
  tiltMax: 34,
  land: 158,
  settle: 170,
  behind: 292,
  trail: -26,
  split: 0.46,
  fold: 0.42,
  span: 0.26,
  spanOver: 0.75,
  commitAhead: 0.3,
  commitBack: 0.72,
  timeA: 640,
  timeB: 520,
  timeC: 170,
};
const rad = (d) => (d * Math.PI) / 180;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInCubic = (t) => t * t * t;
const smooth = (t) => t * t * (3 - 2 * t);
const flatPose = (hinge, bend = 0) => ({ hinge, roll: 0, span: 1, bend });
// 빛은 앞쪽 조금 왼편에서 온다. 띠가 빛을 정면으로 받을수록 밝다.
const LIGHT = { x: -0.28, z: 0.96 };
let turn = null;

/** 넘기는 도중(0~1)의 자세. 앞 구간은 끝만 말려 접히고, 뒤 구간은 스프링 쪽이 들리며 넘어간다. */
function curlPose(p) {
  if (p <= CURL.split) {
    const u = p / CURL.split;
    return { hinge: 0, roll: 1 - (1 - CURL.fold) * u, span: CURL.span, bend: 180 * u };
  }
  const v = (p - CURL.split) / (1 - CURL.split);
  const hinge = CURL.land * smooth(v);
  const far = 180 - (180 - CURL.land) * v;
  return { hinge, roll: CURL.fold * (1 - v) ** 1.5, span: lerp(CURL.span, CURL.spanOver, v), bend: far - hinge };
}

/** 기울어진 축(px)을 따라 u 자리가 휘어서 가는 곳 [X, Z, 그 자리의 기울기(rad)].
    누운 구간, 원호로 휜 구간, 다시 곧은 구간을 이어 붙인다. roll, span 도 px 이다. */
function profile(pose, u, roll, span) {
  const a0 = rad(pose.hinge);
  const k = rad(pose.bend);
  if (u <= roll) return [u * Math.cos(a0), u * Math.sin(a0), a0];
  let x = roll * Math.cos(a0);
  let z = roll * Math.sin(a0);
  const arc = Math.min(u - roll, span);
  const c = k / Math.max(span, 1e-6);
  const a1 = a0 + c * arc;
  if (Math.abs(k) < 1e-6) {
    x += arc * Math.cos(a0);
    z += arc * Math.sin(a0);
  } else {
    x += (Math.sin(a1) - Math.sin(a0)) / c;
    z -= (Math.cos(a1) - Math.cos(a0)) / c;
  }
  const rest = u - roll - span;
  if (rest <= 0) return [x, z, a1];
  const a2 = a0 + k;
  return [x + rest * Math.cos(a2), z + rest * Math.sin(a2), a2];
}

/** 페이지 위 s(0~1) 자리의 [x, z](책 좌표 px). 기울기 없이 스프링에서 잰다. */
function pagePoint(pose, s) {
  const [x, z] = profile(pose, s * BOOK.w, pose.roll * BOOK.w, pose.span * BOOK.w);
  return [x, z];
}

// 끌기용 손잡이 위치표. 페이지 끝의 x 와 고르게 줄어드는 직선을 반씩 섞어, 진행도가 늘면 늘 왼쪽으로만 가게 한다.
const HANDLE = (() => {
  const n = 128;
  const edge = Array.from({ length: n + 1 }, (_, i) => pagePoint(curlPose(i / n), 1)[0]);
  return edge.map((x, i) => 0.5 * x + 0.5 * lerp(edge[0], edge[n], i / n));
})();

/** 손잡이가 x 에 오는 진행도. */
function progressAt(x) {
  const n = HANDLE.length - 1;
  if (x >= HANDLE[0]) return 0;
  for (let i = 1; i <= n; i += 1) {
    if (HANDLE[i] <= x) {
      const a = HANDLE[i - 1];
      return (i - 1 + (a - x) / Math.max(a - HANDLE[i], 1e-6)) / n;
    }
  }
  return 1;
}

/** 접히는 선의 기울기(rad). 끈 방향에서 온다.
    스프링 쪽 평평한 부분이 남아 있는 동안은 기울기를 지키고, 그 부분이 사라지기 전에(접히는 선이 스프링에 닿기 전에) 곧게 선다. */
function tiltNow(t) {
  if (!t.tilt) return 0;
  return t.tilt * smooth(clamp(t.roll / 0.3, 0, 1));
}

function makeTurn(turningIndex, stayingIndex, forward) {
  const flipper = document.createElement('div');
  flipper.className = 'flipper';
  // hinge: 스프링 쪽 평평한 부분이 스프링을 축으로 도는 틀. tilt: 그 평면 안에서 접히는 선의 기울기만큼 도는 틀.
  // 띠는 tilt 안에서 접히는 선과 나란히 놓여 휜다.
  const hinge = document.createElement('div');
  hinge.className = 'hinge';
  const tilt = document.createElement('div');
  tilt.className = 'tilt';
  hinge.append(tilt);
  flipper.append(hinge);
  const strips = [];
  for (let i = 0; i < CURL.arcStrips + 2; i += 1) {
    const strip = document.createElement('div');
    strip.className = 'strip';
    const copy = pageEls[turningIndex].cloneNode(true);
    copy.hidden = false;
    copy.classList.remove('under');
    const shade = document.createElement('i');
    shade.className = 'strip-shade';
    strip.append(copy, shade);
    tilt.append(strip);
    strips.push({ el: strip, copy, shade, cut: '', look: '', shown: true });
  }
  manual.book3d.insertBefore(flipper, manual.rings);
  pageEls.forEach((el, i) => {
    el.hidden = i !== stayingIndex;
    el.classList.toggle('under', i === stayingIndex);
  });
  const under = pageEls[stayingIndex];
  return {
    el: flipper, hingeEl: hinge, hingeKey: '', tiltEl: tilt, tiltKey: '', strips, forward, under, underShade: $('.shade', under),
    ...flatPose(0), p: 0, tilt: 0, gain: 1, legs: [], leg: null, done: null,
  };
}

function poseTurn(t) {
  const W = BOOK.w;
  const H = BOOK.h;
  const phi = tiltNow(t);
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  // 기울어진 축으로 잰 페이지의 범위. s 는 접히는 선에 수직, 띠의 길이 방향이 t 다.
  const sMin = Math.min(0, H * sin);
  const sMax = W * cos + Math.max(0, H * sin);
  const tMin = Math.min(0, -W * sin);
  const tMax = H * cos + Math.max(0, -W * sin);
  const a0 = rad(t.hinge);
  const hingeKey = a0.toFixed(5);
  if (hingeKey !== t.hingeKey) {
    t.hingeKey = hingeKey;
    t.hingeEl.style.transform = a0 ? `rotateY(${(-a0).toFixed(5)}rad)` : '';
  }
  const tiltKey = phi.toFixed(4);
  if (tiltKey !== t.tiltKey) {
    t.tiltKey = tiltKey;
    t.tiltEl.style.transform = phi ? `rotate(${tiltKey}rad)` : '';
  }
  // 휘는 구간만 가는 띠로 촘촘히 나누고, 앞뒤의 곧은 구간은 띠 하나씩으로 덮는다. 모양은 스프링 쪽 평면 안에서 잡는다.
  const shape = { hinge: 0, bend: t.bend };
  const roll = sMax - (1 - t.roll) * W;
  const span = t.span * W;
  const arcStart = clamp(roll, sMin, sMax);
  const arcEnd = clamp(roll + span, arcStart, sMax);
  const n = t.strips.length;
  const edges = [sMin, arcStart];
  for (let i = 1; i <= n - 2; i += 1) edges.push(arcStart + ((arcEnd - arcStart) * i) / (n - 2));
  edges.push(sMax);
  // 띠 가장자리의 그늘. 띠의 법선을 실제 공간으로 돌려 빛과 견준다. 빛을 정면으로 받을수록 밝고, 뒷면이 보이면 조금 더 어둡다.
  // 이웃한 띠가 맞닿는 자리에서 같은 값을 쓰므로 띠 사이에 밝기 경계가 생기지 않는다.
  const ca = Math.cos(a0);
  const sa = Math.sin(a0);
  const shadeAt = (theta) => {
    const nx = -Math.sin(theta) * cos;
    const nz = Math.cos(theta);
    const wx = nx * ca - nz * sa;
    const wz = nx * sa + nz * ca;
    const lit = Math.abs(wx * LIGHT.x + wz * LIGHT.z);
    // 종이는 얇고 밝아서, 빛을 비스듬히 받아도 회색 정도로만 어두워진다.
    const back = 0.035 * smooth(clamp(-wz / 0.3, 0, 1));
    return clamp((0.96 - lit) * 0.42 + back, 0, 0.34);
  };
  // 그림자용: 띠 가운데 줄의 점을 실제 공간으로 옮겨, 접히는 선에 수직으로 가장 바깥인 곳과 가장 높은 곳을 찾는다.
  const tMid = (tMin + tMax) / 2;
  let maxS = sMin;
  let maxZ = 0;
  const reach = ([X, Z]) => {
    const px = X * cos - tMid * sin;
    const py = X * sin + tMid * cos;
    const wx = px * ca - Z * sa;
    maxS = Math.max(maxS, wx * cos + py * sin);
    maxZ = Math.max(maxZ, px * sa + Z * ca);
  };
  let prev = profile(shape, edges[0], roll, span);
  reach(prev);
  for (let j = 0; j < n; j += 1) {
    const s0 = edges[j];
    const next = profile(shape, edges[j + 1], roll, span);
    const strip = t.strips[j];
    const w = edges[j + 1] - s0;
    const show = w > 0.05;
    if (show !== strip.shown) {
      strip.shown = show;
      strip.el.style.visibility = show ? '' : 'hidden';
    }
    if (show) {
      const cut = `${s0.toFixed(2)} ${w.toFixed(2)} ${tiltKey}`;
      if (cut !== strip.cut) {
        strip.cut = cut;
        // 이웃한 띠와 조금 겹쳐야 휘었을 때 틈이 보이지 않는다.
        strip.el.style.width = `${(w + CURL.seam).toFixed(2)}px`;
        strip.el.style.height = `${(tMax - tMin).toFixed(2)}px`;
        strip.copy.style.transform = `translate(${(-s0).toFixed(2)}px, ${(-tMin).toFixed(2)}px)${phi ? ` rotate(${(-phi).toFixed(4)}rad)` : ''}`;
      }
      const a = Math.atan2(next[1] - prev[1], next[0] - prev[0]);
      strip.el.style.transform = `translate3d(${prev[0].toFixed(2)}px, ${tMin.toFixed(2)}px, ${prev[1].toFixed(2)}px) rotateY(${(-a).toFixed(4)}rad)`;
      const look = `linear-gradient(90deg, rgba(11, 12, 12, ${shadeAt(prev[2]).toFixed(3)}), rgba(11, 12, 12, ${shadeAt(next[2]).toFixed(3)}))`;
      if (look !== strip.look) {
        strip.look = look;
        strip.shade.style.background = look;
      }
      reach(next);
    }
    prev = next;
  }
  // 들린 페이지가 아래 페이지에 드리우는 그림자. 접히는 선과 같은 기울기로, 들린 부분 아래가 가장 어둡고 바깥으로 옅어진다.
  const lift = clamp(maxZ / (W * 0.3), 0, 1);
  const cover = clamp((176 - t.hinge) / 40, 0, 1);
  const under = t.underShade.style;
  under.setProperty('--sa', `${((phi * 180) / Math.PI).toFixed(2)}deg`);
  under.setProperty('--sx', `${(clamp(maxS, sMin, sMax) - sMin).toFixed(1)}px`);
  under.setProperty('--sw', `${(16 + 0.2 * maxZ).toFixed(1)}px`);
  under.opacity = (0.62 * lift * cover).toFixed(3);
}

/** 자세 변화를 차례로 이어 붙인다. 각 다리는 (eased u) => 자세 함수를 가진다. */
function runLegs(t, legs, done) {
  t.legs = legs.slice();
  t.done = done;
  nextLeg(t);
}

function nextLeg(t) {
  const leg = t.legs.shift();
  if (!leg) {
    t.leg = null;
    const done = t.done;
    t.done = null;
    done?.();
    return;
  }
  t.leg = { ...leg, start: performance.now() };
}

function stepTurn(now) {
  const t = turn;
  if (!t || !t.leg) return;
  const { start, ms, ease, fn } = t.leg;
  const u = ms > 0 ? clamp((now - start) / ms, 0, 1) : 1;
  Object.assign(t, fn((ease ?? easeInOutCubic)(u)));
  poseTurn(t);
  if (u >= 1) nextLeg(t);
}

// 다리(자세 변화) 모음
const legCurl = (p0, p1, ms, ease) => ({ ms, ease, fn: (u) => ({ ...curlPose(lerp(p0, p1, u)), p: lerp(p0, p1, u) }) });
const legSettle = (from, to, ms, ease) => ({ ms, ease, fn: (u) => flatPose(lerp(from, to, u)) });
const legWrap = (from, to, bendFrom, bendTo, ms, ease) => ({ ms, ease, fn: (u) => flatPose(lerp(from, to, u), lerp(bendFrom, bendTo, u)) });

function endTurn() {
  if (!turn) return;
  const t = turn;
  turn = null;
  t.el.remove();
  t.underShade.style.opacity = '';
  t.underShade.style.removeProperty('--sa');
  t.underShade.style.removeProperty('--sx');
  t.underShade.style.removeProperty('--sw');
  showOnly(manual.index);
}

/** 진행 중인 넘김을 즉시 끝 상태로 보낸다. */
function finishTurn() {
  if (!turn) return;
  drag.active = false;
  drag.pending = null;
  body.classList.remove('page-drag');
  endTurn();
}

const stopFlip = finishTurn;

/** 펼친 페이지에 맞춰 카메라를 옮기고 그 섹션에 테두리를 띄운다. */
function syncPage(duration = FLIP_MS) {
  const page = PAGES[manual.index];
  const target = manual.open && page.sec ? sections[page.sec] : null;
  if ((pageHighlight?.target ?? null) !== target) {
    dropHighlight(pageHighlight);
    pageHighlight = target ? addHighlight(target) : null;
    if (hover) {
      if (hover.el === target && hover.hl) {
        dropHighlight(hover.hl);
        hover.hl = null;
      } else if (hover.el !== target && !hover.hl) {
        hover.hl = addHighlight(hover.el);
      }
    }
  }
  moveCamera(cameraTarget(), duration);
  $('#btn-prev').setAttribute('aria-disabled', String(manual.index === 0));
  $('#btn-next').setAttribute('aria-disabled', String(manual.index === PAGES.length - 1));
}

/** 페이지 번호를 바꾸고 카메라·테두리·기록을 맞춘다. */
function commitPage(index) {
  manual.index = index;
  syncPage();
  log('PAGE', pad2(index));
}

/** 버튼, 차례, 페이지 클릭으로 넘길 때. 자동으로 휘며 넘어간다. */
function flipTo(target) {
  const index = clamp(target, 0, PAGES.length - 1);
  if (!manual.open || index === manual.index) return;
  finishTurn();
  const from = manual.index;
  commitPage(index);
  if (still()) {
    showOnly(index);
    return;
  }
  const forward = index > from;
  turn = makeTurn(forward ? from : index, forward ? index : from, forward);
  if (forward) {
    poseTurn(turn);
    runLegs(turn, [
      legCurl(0, 1, CURL.timeA, easeInOutCubic),
      legSettle(CURL.land, CURL.settle, CURL.timeB, easeOutCubic),
      legWrap(CURL.settle, CURL.behind, 0, CURL.trail, CURL.timeC, easeInCubic),
    ], endTurn);
  } else {
    // 이전 페이지는 책 뒤에서 감겨 나와 왼쪽에 잠깐 선 뒤, 넘어올 때의 모양을 거꾸로 밟으며 오른쪽에 펼쳐진다.
    Object.assign(turn, flatPose(CURL.behind, CURL.trail), { p: 1 });
    poseTurn(turn);
    runLegs(turn, [
      legWrap(CURL.behind, CURL.settle, CURL.trail, 0, CURL.timeC + 50, easeOutCubic),
      legSettle(CURL.settle, CURL.land, 220, easeInOutCubic),
      legCurl(1, 0, CURL.timeA + 80, easeInOutCubic),
    ], endTurn);
  }
}

/* ---------- 페이지를 잡고 끌어 넘기기 ---------- */

const drag = { pending: null, active: false, samples: [], blockClickUntil: 0 };

function beginDrag(forward) {
  const from = manual.index;
  const to = forward ? from + 1 : from - 1;
  if (to < 0 || to >= PAGES.length || still()) return false;
  finishTurn();
  turn = makeTurn(forward ? from : to, forward ? to : from, forward);
  turn.drag = { from, to };
  if (forward) {
    // 스프링에서 먼 곳을 잡으면 페이지 끝이 손을 그대로 따라오고, 가까이 잡을수록 크게 따라온다.
    turn.gain = clamp(1 / Math.max(drag.pending?.grab ?? 1, 0.42), 1, 2.4);
    poseTurn(turn);
  } else {
    // 되돌릴 페이지가 먼저 책 뒤에서 감겨 나와 왼쪽에 선다. 그동안 끈 거리는 기억해 두었다가 이어 받는다.
    turn.gain = 2;
    Object.assign(turn, flatPose(CURL.behind, CURL.trail), { p: 1 });
    poseTurn(turn);
    runLegs(turn, [
      legWrap(CURL.behind, CURL.settle, CURL.trail, 0, CURL.timeC, easeOutCubic),
      legSettle(CURL.settle, CURL.land, 120, easeOutCubic),
    ], () => {
      if (drag.lastDx !== undefined) followDrag(drag.lastDx, drag.lastDy ?? 0);
    });
  }
  return true;
}

/** 끈 거리(책 좌표)만큼 손잡이를 옮기고 그 진행도의 자세를 잡는다. 비스듬히 끌면 접히는 선도 그 방향으로 기운다. */
function followDrag(dx, dy = 0) {
  drag.lastDx = dx;
  drag.lastDy = dy;
  const t = turn;
  if (!t || t.leg) return;
  // along: 넘기는 쪽으로 간 거리, across: 위아래로 비킨 거리. 막 끌기 시작했을 때는 방향이 흔들리므로 기울기를 조금씩 들인다.
  const along = t.forward ? -dx : dx;
  const across = t.forward ? -dy : dy;
  const limit = rad(CURL.tiltMax);
  const want = clamp(Math.atan2(across, Math.max(along, 1)), -limit, limit) * clamp((Math.hypot(dx, dy) - 8) / 60, 0, 1);
  t.tilt += (want - t.tilt) * 0.45;
  const dist = along * Math.cos(t.tilt) + across * Math.sin(t.tilt);
  const start = t.forward ? HANDLE[0] : HANDLE[HANDLE.length - 1];
  const p = progressAt(start + (t.forward ? -dist : dist) * t.gain);
  Object.assign(t, curlPose(p), { p });
  poseTurn(t);
}

function releaseDrag(cancelled) {
  const t = turn;
  drag.active = false;
  drag.pending = null;
  body.classList.remove('page-drag');
  if (!t || !t.drag) return;
  // 마지막 0.12초의 속도로 휙 넘긴 것인지 본다(책 좌표/ms).
  const now = performance.now();
  const recent = drag.samples.filter((s) => now - s.t < 120);
  const v = recent.length > 1 ? (recent[recent.length - 1].x - recent[0].x) / Math.max(1, recent[recent.length - 1].t - recent[0].t) : 0;
  const { to } = t.drag;
  if (t.leg) {
    // 이전 페이지가 아직 감겨 나오는 중에 놓으면 그대로 책 뒤로 돌려보낸다.
    runLegs(t, [legWrap(t.hinge, CURL.behind, t.bend, CURL.trail, CURL.timeC, easeInCubic)], endTurn);
    return;
  }
  const commit = !cancelled && (t.forward ? t.p > CURL.commitAhead || v < -0.45 : t.p < CURL.commitBack || v > 0.45);
  if (t.forward && commit) {
    commitPage(to);
    runLegs(t, [
      legCurl(t.p, 1, Math.max(160, (1 - t.p) * CURL.timeA), easeOutCubic),
      legSettle(CURL.land, CURL.settle, CURL.timeB, easeOutCubic),
      legWrap(CURL.settle, CURL.behind, 0, CURL.trail, CURL.timeC, easeInCubic),
    ], endTurn);
  } else if (t.forward) {
    runLegs(t, [legCurl(t.p, 0, Math.max(140, t.p * 520), easeOutCubic)], endTurn);
  } else if (commit) {
    commitPage(to);
    runLegs(t, [legCurl(t.p, 0, Math.max(160, t.p * CURL.timeA), easeOutCubic)], endTurn);
  } else {
    runLegs(t, [
      legCurl(t.p, 1, Math.max(140, (1 - t.p) * 460), easeOutCubic),
      legWrap(CURL.land, CURL.behind, 0, CURL.trail, CURL.timeC, easeInCubic),
    ], endTurn);
  }
}

function setControls(open) {
  $('#ctl-closed').hidden = open;
  $('#ctl-open').hidden = !open;
  body.classList.toggle('manual-open', open);
  if (infoAnchor) closeInfo();
}

function openManual(index = manual.index) {
  if (manual.open) {
    flipTo(index);
    return;
  }
  manual.open = true;
  manual.index = clamp(index, 0, PAGES.length - 1);
  manual.root.hidden = false;
  layoutBook();
  stopFlip();
  showOnly(manual.index);
  manual.fly?.cancel();
  manual.fly = still() ? null : manual.flyEl.animate([
    { transform: 'translate(52%, 80%) rotate(-14deg)', offset: 0 },
    { transform: 'translate(-1%, -1.2%) rotate(0.8deg)', offset: 0.72 },
    { transform: 'translate(0, 0) rotate(0deg)', offset: 1 },
  ], { duration: 640, easing: 'cubic-bezier(.22,.8,.3,1)' });
  setControls(true);
  syncPage();
  sound.whoosh();
  log('OPEN', 'MANUAL');
}

function closeManual() {
  if (!manual.open) return;
  manual.open = false;
  stopFlip();
  manual.fly?.cancel();
  const fly = manual.flyEl.animate([
    { transform: 'translate(0, 0) rotate(0deg)' },
    { transform: 'translate(46%, 96%) rotate(-12deg)' },
  ], { duration: still() ? 1 : 430, easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'forwards' });
  manual.fly = fly;
  fly.finished.then(() => {
    if (manual.open) return;
    manual.root.hidden = true;
    fly.cancel();
  }).catch(() => {});
  setControls(false);
  syncPage();
  sound.whoosh();
  log('CLOSE', 'MANUAL');
}

/* ---------- 정보 팝업 ---------- */

let infoAnchor = null;

function closeInfo() {
  hidePop(infoPop);
  infoAnchor = null;
}

function toggleInfo(button) {
  if (infoAnchor === button) {
    closeInfo();
    return;
  }
  infoAnchor = button;
  showPop(infoPop, button, {
    kind: 'INFO',
    num: 'V1',
    title: 'ABOUT THIS MACHINE',
    text: "A LIVE MACHINE THAT MEASURES YOU WHILE YOU READ ITS MANUAL. MADE FOR HOON, AFTER STRIPE'S BF/CM MK II.",
    side: 'l',
    follow: false,
    scene: false,
  });
}

/* ---------- 부팅 화면 ---------- */

const ASCII = [
  '==  ==   ======   ======   ==   ==   (TM)',
  '==  ==   ==  ==   ==  ==   ===  ==',
  '======   ==  ==   ==  ==   == = ==',
  '==  ==   ==  ==   ==  ==   ==  ===',
  '==  ==   ======   ======   ==   ==',
];
const BOOT_SIDE = ['HOON MK I', 'SERIAL 07-07-07', 'API V1'];
const CHECKS = [
  ['CURSOR TRACKING ARRAY', 'CALIBRATED'],
  ['POPUP PROJECTOR', 'WARMED'],
  ['PAGE TURNING MOTOR', 'OILED'],
  ['CAMERA GIMBAL', 'CENTERED'],
  ['SEVEN SEGMENT DRIVERS', 'LIT'],
  ['RECEIPT PRINTER', 'LOADED'],
  ['POST INITIALIZATION SEQUENCE', 'DONE'],
];
let bootRun = 0;

async function runBoot() {
  const run = ++bootRun;
  const boot = $('#boot');
  const crt = $('.crt', boot);
  const ascii = $('#boot-ascii');
  const lines = $('#boot-lines');
  const side = $('#boot-side');
  body.classList.add('booting');
  setHover(null);
  boot.classList.remove('out', 'gone');
  crt.classList.remove('logo');
  ascii.textContent = '';
  lines.textContent = '';
  side.textContent = '';

  // 누르면 남은 글을 한꺼번에 찍고 넘어간다.
  let skip = still();
  boot.addEventListener('pointerdown', () => { skip = true; }, { once: true });
  const wait = (ms) => (skip ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms)));
  const text = [];
  const write = () => { lines.textContent = text.join('\n'); };

  for (let i = 0; i < ASCII.length; i += 1) {
    ascii.textContent = `${ASCII.slice(0, i + 1).join('\n')}\n`;
    await wait(60);
  }
  side.textContent = BOOT_SIDE.join('\n');
  await wait(140);
  text.push('', '[ HUMAN OBSERVATION MONITOR ]', '', '', '');
  write();
  await wait(420);
  text.push('HOON BIOS -- V1.07');
  write();
  await wait(130);
  text.push('21 degrees POST driver', '');
  write();
  await wait(260);
  text.push('--- System health check start ---', '');
  write();
  await wait(280);
  for (const [name, status] of CHECKS) {
    text.push(name);
    write();
    await wait(170);
    text.push(`  [${status}]`, '');
    write();
    await wait(140);
  }
  text.push('--- System health check end ---', '');
  write();
  await wait(260);
  text.push('HOON MK I BOOT READY');
  write();
  await wait(420);
  if (run !== bootRun) return;

  crt.classList.add('logo');
  boot.classList.add('out');
  body.classList.remove('booting');
  log('BOOT', 'READY');
  setTimeout(() => {
    if (run === bootRun) boot.classList.add('gone');
  }, 900);
}

function reboot() {
  log('REBOOT', 'MK I');
  closeManual();
  setTimeout(runBoot, still() ? 0 : 480);
}

/* ---------- 입력 ---------- */

window.addEventListener('pointermove', (event) => {
  const now = performance.now();
  if (pointer.seen) {
    const d = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    // 창 밖에서 돌아온 순간처럼 크게 튄 값은 세지 않는다.
    if (d < 400) {
      live.travel += d;
      motion.samples.push({ t: now, d });
    }
  }
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.seen = true;
  pointer.touch = event.pointerType === 'touch';
  pushTrail(now);
  setHover(event.target.closest?.('[data-sec]') ?? null);
}, { passive: true });

window.addEventListener('pointerdown', (event) => {
  live.clicks.push(performance.now());
  sound.wake();
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.seen = true;
  pointer.touch = event.pointerType === 'touch';
  if (infoAnchor && !event.target.closest('.info')) closeInfo();
  if (pointer.touch) setHover(event.target.closest?.('[data-sec]') ?? null);
}, true);

document.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget) setHover(null);
});
window.addEventListener('blur', () => setHover(null));

window.addEventListener('wheel', (event) => {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? vp.h : 1;
  live.wheel += (Math.abs(event.deltaY) + Math.abs(event.deltaX)) * unit;
}, { passive: true });

world.addEventListener('click', (event) => {
  const el = event.target.closest('[data-sec]');
  if (el) activate(el, event);
});
world.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-sec][role="button"]')) {
    event.preventDefault();
    activate(event.target, event);
  }
});
document.addEventListener('focusin', (event) => {
  const el = event.target.closest?.('[data-sec]');
  if (el && el.matches(':focus-visible')) setHover(el);
});
document.addEventListener('focusout', (event) => {
  if (hover && event.target === hover.el && !hover.el.matches(':hover')) setHover(null);
});

// 페이지를 잡고 좌우로 끌면 넘기는 과정을 손으로 조절한다. 짧게 누르면 클릭으로 다음 장이 넘어간다.
manual.book.addEventListener('pointerdown', (event) => {
  // 새로 누르면 그 뒤의 클릭은 끌기와 상관없는 진짜 클릭이다.
  drag.blockClickUntil = 0;
  if (!manual.open || event.button !== 0) return;
  if (event.target.closest('[data-goto], [data-reboot]')) return;
  const box = manual.book.getBoundingClientRect();
  // 스프링에서 얼마나 먼 곳을 잡았는지(0~1). 먼 곳일수록 페이지 끝이 손을 그대로 따라온다.
  const grab = clamp((event.clientX - box.left) / Math.max(1, box.width), 0, 1);
  drag.pending = { x: event.clientX, y: event.clientY, id: event.pointerId, grab };
  drag.samples = [];
  drag.lastDx = undefined;
  drag.lastDy = undefined;
});
window.addEventListener('pointermove', (event) => {
  const pending = drag.pending;
  if (!pending || event.pointerId !== pending.id) return;
  const dx = event.clientX - pending.x;
  const dy = event.clientY - pending.y;
  if (!drag.active) {
    // 옆으로든 비스듬히든 끌면 넘기기 시작한다. 세로에 가깝게 끌 때만 넘기지 않는다.
    if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 0.6) return;
    if (!beginDrag(dx < 0)) {
      drag.pending = null;
      return;
    }
    drag.active = true;
    body.classList.add('page-drag');
    try {
      manual.book.setPointerCapture(event.pointerId);
    } catch {
      // 포인터를 붙잡지 못해도 창 전체에서 움직임을 받는다.
    }
  }
  const scale = manual.box?.scale ?? 1;
  const dxBook = dx / scale;
  drag.samples.push({ t: performance.now(), x: dxBook });
  if (drag.samples.length > 12) drag.samples.shift();
  followDrag(dxBook, dy / scale);
}, { passive: true });
// 끌기를 놓은 바로 뒤에 따라오는 클릭만 막는다. 클릭이 오지 않아도 잠시 뒤에는 저절로 풀린다.
const CLICK_AFTER_DRAG_MS = 400;
window.addEventListener('pointerup', (event) => {
  if (!drag.pending || event.pointerId !== drag.pending.id) return;
  if (drag.active) {
    drag.blockClickUntil = performance.now() + CLICK_AFTER_DRAG_MS;
    releaseDrag(false);
  } else {
    drag.pending = null;
  }
});
window.addEventListener('pointercancel', (event) => {
  if (!drag.pending || event.pointerId !== drag.pending.id) return;
  if (drag.active) {
    drag.blockClickUntil = performance.now() + CLICK_AFTER_DRAG_MS;
    releaseDrag(true);
  } else {
    drag.pending = null;
  }
});

manual.book.addEventListener('click', (event) => {
  if (!manual.open) return;
  if (performance.now() < (drag.blockClickUntil ?? 0)) {
    // 끌어서 넘긴 뒤 따라오는 클릭은 무시한다.
    drag.blockClickUntil = 0;
    event.preventDefault();
    return;
  }
  const goto = event.target.closest('[data-goto]');
  if (goto) {
    event.preventDefault();
    flipTo(Number(goto.dataset.goto));
    return;
  }
  if (event.target.closest('[data-reboot]')) {
    reboot();
    return;
  }
  if (manual.index < PAGES.length - 1) flipTo(manual.index + 1);
});
manual.book.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-reboot]')) {
    event.preventDefault();
    reboot();
  }
});

// 버튼에 적힌 [M] 그대로, M 키로 설명서를 열고 닫는다.
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key !== 'm' && event.key !== 'M') return;
  if (body.classList.contains('booting')) return;
  if (manual.open) closeManual();
  else openManual();
});

const audioButton = $('#btn-audio');
const videoButton = $('#btn-video');
const QUALITIES = [['4k', '2160P/4K'], ['hd', '1080P/HD'], ['sd', '480P/SD']];
let quality = Math.max(0, QUALITIES.findIndex(([key]) => key === store.get('video', '4k')));

function paintAudio() {
  audioButton.textContent = `AUDIO [${sound.on ? 'ON' : 'OFF'}]`;
}
function paintVideo() {
  const [key, label] = QUALITIES[quality];
  body.dataset.q = key;
  videoButton.textContent = `VIDEO [${label}]`;
}

$('#hud').addEventListener('click', (event) => {
  if (event.target.closest('button')) sound.click();
});
audioButton.addEventListener('click', () => {
  sound.on = !sound.on;
  paintAudio();
  log('AUDIO', sound.on ? 'ON' : 'OFF');
});
videoButton.addEventListener('click', () => {
  quality = (quality + 1) % QUALITIES.length;
  store.set('video', QUALITIES[quality][0]);
  paintVideo();
  log('VIDEO', QUALITIES[quality][1].split('/')[0]);
});
$('#btn-full').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
$('#btn-manual').addEventListener('click', () => openManual());
$('#btn-open').addEventListener('click', () => openManual());
$('#btn-prev').addEventListener('click', () => flipTo(manual.index - 1));
$('#btn-next').addEventListener('click', () => flipTo(manual.index + 1));
$('#btn-restart').addEventListener('click', () => flipTo(0));
$('#btn-close').addEventListener('click', closeManual);
$$('.info').forEach((button) => button.addEventListener('click', () => toggleInfo(button)));

window.addEventListener('resize', () => {
  measure();
  layoutBook();
  moveCamera(cameraTarget(), 0);
  for (const pop of pops) {
    if (!pop.anchor) continue;
    pop.w = pop.el.offsetWidth;
    pop.h = pop.el.offsetHeight;
    chooseSide(pop, pop.anchor.getBoundingClientRect());
  }
});

window.addEventListener('pagehide', () => {
  store.set('travel', Math.floor(live.travel));
  store.set('wheel', Math.floor(live.wheel));
});

/* ---------- 매 프레임 ---------- */

let lastFrame = performance.now();
let slowAt = 0;

function loop(now) {
  const dt = Math.min(64, now - lastFrame);
  lastFrame = now;
  const moving = stepCamera(now);
  stepTurn(now);
  // 카메라가 움직이면 포인터 아래의 부분도 바뀐다.
  if (moving && pointer.seen && !pointer.touch) setHover(sectionAt(pointer.x, pointer.y));
  for (const hl of highlights) placeHighlight(hl);
  updatePops(dt);
  live.frames += 1;
  if (now - live.fpsAt >= 1000) {
    live.fps = (live.frames * 1000) / (now - live.fpsAt);
    live.frames = 0;
    live.fpsAt = now;
  }
  updateMotion(now, dt);
  drawScope(now);
  if (now - slowAt >= 80) {
    slowAt = now;
    updateDisplays(now);
  }
  requestAnimationFrame(loop);
}

measure();
layoutBook();
paintAudio();
paintVideo();
moveCamera(cameraTarget(), 0);
printEntry('HOON MK I', 'EVENT LOG', 'head');
log('POWER', 'ON');
updateDisplays(performance.now());
requestAnimationFrame(loop);
runBoot();
