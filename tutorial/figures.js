// 설명서 페이지의 선 그림. 모두 이 파일에 고정된 SVG 문자열이고, 바깥 값은 들어오지 않는다.

/** 7세그먼트 한 자리의 일곱 조각(a~g)을 폴리곤 좌표 문자열로 만든다. */
export function segmentPoints(w, h, t, g = t * 0.2) {
  const hBar = (x1, x2, y) => [[x1, y], [x1 + t / 2, y - t / 2], [x2 - t / 2, y - t / 2], [x2, y], [x2 - t / 2, y + t / 2], [x1 + t / 2, y + t / 2]];
  const vBar = (x, y1, y2) => [[x, y1], [x + t / 2, y1 + t / 2], [x + t / 2, y2 - t / 2], [x, y2], [x - t / 2, y2 - t / 2], [x - t / 2, y1 + t / 2]];
  const l = t / 2;
  const r = w - t / 2;
  const top = t / 2;
  const mid = h / 2;
  const bot = h - t / 2;
  const parts = {
    a: hBar(l + g, r - g, top),
    b: vBar(r, top + g, mid - g),
    c: vBar(r, mid + g, bot - g),
    d: hBar(l + g, r - g, bot),
    e: vBar(l, mid + g, bot - g),
    f: vBar(l, top + g, mid - g),
    g: hBar(l + g, r - g, mid),
  };
  const out = {};
  for (const [key, points] of Object.entries(parts)) {
    out[key] = points.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(' ');
  }
  return out;
}

const svg = (body, w = 440, h = 230) => `<svg class="fig-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">${body}</svg>`;
const label = (x, y, text, cls = '') => `<text x="${x}" y="${y}" class="lbl ${cls}">${text}</text>`;
const arrowHead = (x, y, angle) => `<path class="fill" transform="translate(${x} ${y}) rotate(${angle})" d="M0 0-7-3.2-7 3.2Z"/>`;
const callout = (x, y, n) => `<circle class="ln paper" cx="${x}" cy="${y}" r="7.5"/>${label(x, y + 3.4, n, 'mid b')}`;

function box(x, y, w, h, title, sub) {
  return `<rect class="ln paper" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`
    + label(x + w / 2, y + h / 2 - 2, title, 'mid b')
    + label(x + w / 2, y + h / 2 + 12, sub, 'mid');
}

const FIGS = {
  flow: () => svg(
    box(20, 28, 150, 54, 'VISITOR', "(THAT'S YOU)")
    + box(270, 28, 150, 54, 'POINTER', '(MOUSE OR TOUCH)')
    + box(270, 150, 150, 54, 'HOON MK I', '(THIS MACHINE)')
    + box(20, 150, 150, 54, 'DISPLAYS', '(TWELVE MODULES)')
    + `<path class="ln dash" d="M172 55H262"/>${arrowHead(268, 55, 0)}${label(217, 47, 'MOVES', 'mid')}${label(217, 71, 'CLICKS', 'mid')}`
    + `<path class="ln dash" d="M345 84V142"/>${arrowHead(345, 148, 90)}${label(353, 118, 'EVENTS')}`
    + `<path class="ln dash" d="M268 177H178"/>${arrowHead(172, 177, 180)}${label(223, 169, 'LIGHTS UP', 'mid')}`
    + `<path class="ln dot" d="M95 148V86"/>${label(103, 120, 'YOU LOOK')}`,
  ),

  trail: () => {
    const pts = [[40, 190], [110, 148], [190, 160], [262, 104], [330, 96], [392, 52]];
    const dots = pts.map(([x, y], i) => `<circle class="fill" cx="${x}" cy="${y}" r="3.2"/>${label(x - 4, y + (i % 2 ? -10 : 17), `P${i}`, 'b')}`).join('');
    return svg(
      `<path class="ln dash" d="M${pts.map((p) => p.join(' ')).join('L')}"/>${dots}`
      + '<path class="ln thin" d="M190 160H262V104"/>'
      + label(226, 176, 'ΔX', 'mid') + label(270, 138, 'ΔY') + label(214, 124, 'D', 'mid b')
      + '<path class="fill" d="M392 52v23l6-6 5 11 4-2-5-11h8Z"/><path class="ln thin" d="M392 52v23l6-6 5 11 4-2-5-11h8Z"/>'
      + label(300, 196, 'D = √(ΔX² + ΔY²)', 'big') + label(300, 214, 'TOTAL = Σ D', 'big'),
    );
  },

  lcd: () => {
    const seg = segmentPoints(84, 150, 16);
    const polys = Object.entries(seg).map(([key, p]) => `<polygon class="ln" points="${p}"/>`).join('');
    const tags = { a: [42, -6], b: [100, 40], c: [100, 112], d: [42, 168], e: [-16, 112], f: [-16, 40], g: [42, 70] };
    const tagText = Object.entries(tags).map(([key, [x, y]]) => label(x, y, key.toUpperCase(), 'mid b')).join('');
    const pins = 'ABCDEFG'.split('').map((p, i) => `<path class="ln thin" d="M262 ${44 + i * 20}H300"/>${label(254, 48 + i * 20, p, 'end b')}`).join('');
    return svg(
      `<g transform="translate(60 40) skewX(-4)">${polys}${tagText}</g>`
      + `<rect class="ln paper" x="300" y="30" width="110" height="150" rx="3"/>${pins}`
      + label(355, 100, 'DRIVER', 'mid b') + label(355, 114, 'IC', 'mid')
      + label(355, 214, 'COMMON CATHODE', 'mid'),
    );
  },

  chart: () => {
    const values = [8, 14, 11, 22, 18, 30, 26, 41, 33, 47, 38, 29, 35, 24, 31, 20];
    const step = 360 / (values.length - 1);
    const line = values.map((v, i) => `${(50 + i * step).toFixed(1)} ${(190 - v * 3).toFixed(1)}`).join('L');
    const peakX = 50 + 9 * step;
    return svg(
      '<path class="ln" d="M50 20V190H415"/>'
      + [0, 20, 40].map((v) => `<path class="ln thin" d="M46 ${190 - v * 3}H50"/>${label(42, 194 - v * 3, String(v), 'end')}`).join('')
      + `<path class="ln" d="M${line}"/>`
      + `<path class="ln dash thin" d="M50 49H410"/>${label(410, 42, 'PEAK 47', 'end b')}`
      + `<circle class="ln paper" cx="${peakX.toFixed(1)}" cy="49" r="4.5"/>`
      + label(50, 210, '-60 S', 'mid') + label(232, 210, '-30 S', 'mid') + label(410, 210, 'NOW', 'mid b'),
    );
  },

  bars: () => {
    const rows = [['#01', 'SCOPE', 300], ['#02', 'GAUGE', 236], ['#03', 'TRAVEL', 182], ['#04', 'FPS', 120], ['#05', 'ROLL', 70]];
    const hatch = '<defs><pattern id="fig-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="ln thin" d="M0 0V6"/></pattern></defs>';
    const body = rows.map(([rank, name, w], i) => {
      const y = 22 + i * 40;
      return label(20, y + 17, rank, 'b') + label(52, y + 17, name)
        + `<rect class="ln" x="112" y="${y}" width="${w}" height="24" fill="url(#fig-hatch)"/>`
        + label(120 + w, y + 17, String(Math.round(w / 12)));
    }).join('');
    return svg(hatch + body);
  },

  printer: () => svg(
    '<rect class="ln dash thin" x="14" y="14" width="412" height="200" rx="4"/>'
    + '<circle class="ln" cx="96" cy="112" r="62"/><circle class="ln" cx="96" cy="112" r="15"/>'
    + '<path class="ln thin" d="M96 64a48 48 0 0 1 48 48M96 76a36 36 0 0 1 36 36"/>'
    + '<path class="ln" d="M96 174H238Q262 174 264 150Q268 100 300 80L392 34"/>'
    + '<circle class="ln paper" cx="262" cy="150" r="22"/><circle class="fill" cx="262" cy="150" r="3"/>'
    + '<rect class="ln paper" x="226" y="178" width="58" height="16" rx="2"/>'
    + '<path class="ln" d="M380 22l22 16M370 36l22 16"/>'
    + label(96, 202, 'PAPER ROLL', 'mid') + label(300, 154, 'PLATEN') + label(255, 210, 'THERMAL HEAD', 'mid')
    + label(398, 70, 'SLOT', 'mid b') + label(318, 112, 'PAPER PATH'),
  ),

  receipt: () => {
    const lines = ['14:03:22 HOVER SCOPE', '14:03:19 PAGE 07', '14:03:12 OPEN MANUAL', '14:02:58 CLICK TRAVEL', '14:02:41 HOVER GAUGE'];
    // 아래 가장자리는 오른쪽에서 왼쪽으로 톱니 모양으로 찢겨 있다.
    const zig = Array.from({ length: 25 }, (_, k) => `L${288 - k * 5} ${k % 2 ? 220 : 214}`).join('');
    return svg(
      `<path class="ln paper" d="M168 8H288V214${zig}Z"/>`
      + label(228, 30, 'HOON MK I', 'mid b') + label(228, 44, 'EVENT LOG', 'mid')
      + '<path class="ln dot" d="M176 54H280"/>'
      + lines.map((line, i) => label(176, 74 + i * 22, line, i === 0 ? 'b' : '')).join('')
      + '<path class="ln thin" d="M174 70H120"/>' + label(112, 74, 'NEWEST', 'end b')
      + '<path class="ln thin" d="M174 158H120"/>' + label(112, 162, 'OLDER', 'end')
      + '<path class="ln" d="M330 190V40"/>' + arrowHead(330, 34, -90) + label(340, 120, 'FEED'),
    );
  },

  clock: () => {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const r1 = i % 3 ? 70 : 62;
      return `<path class="ln${i % 3 ? ' thin' : ''}" d="M${(110 + Math.sin(a) * r1).toFixed(1)} ${(115 - Math.cos(a) * r1).toFixed(1)}L${(110 + Math.sin(a) * 78).toFixed(1)} ${(115 - Math.cos(a) * 78).toFixed(1)}"/>`;
    }).join('');
    return svg(
      `<circle class="ln" cx="110" cy="115" r="86"/>${ticks}`
      + '<path class="ln" d="M110 115 146 92M110 115 104 54"/><circle class="fill" cx="110" cy="115" r="4"/>'
      + '<path class="ln" d="M268 115H286M286 95V135M296 99V131M306 95V135M306 115H324"/><rect class="ln" x="290" y="99" width="12" height="32"/>'
      + label(296, 160, '32.768 KHZ', 'mid b')
      + '<rect class="ln paper" x="338" y="96" width="76" height="38" rx="2"/>' + label(376, 112, '÷ 2^15', 'mid b') + label(376, 126, '= 1 HZ', 'mid')
      + '<path class="ln dash" d="M376 136V196H214"/>' + arrowHead(208, 196, 180) + label(300, 212, 'ONE TICK PER SECOND', 'mid'),
    );
  },

  mouse: () => svg(
    '<path class="ln" d="M220 24C176 24 160 58 160 100V160C160 196 186 214 220 214S280 196 280 160V100C280 58 264 24 220 24Z"/>'
    + '<path class="ln thin" d="M220 24V96M160 100H280"/>'
    + '<rect class="ln paper" x="211" y="48" width="18" height="38" rx="9"/>'
    + '<path class="ln thin" d="M213 56H227M213 63H227M213 70H227M213 77H227"/>'
    + '<path class="ln" d="M250 66V30"/>' + arrowHead(250, 24, -90) + '<path class="ln" d="M250 70V106"/>' + arrowHead(250, 112, 90)
    + label(300, 40, 'UP: +|ΔY|', 'b') + label(300, 112, 'DOWN: +|ΔY|', 'b')
    + '<path class="ln thin" d="M209 66H120"/>' + label(112, 70, 'WHEEL', 'end b')
    + label(112, 86, '1 NOTCH ≈ 100 PX', 'end'),
  ),

  film: () => {
    const holes = Array.from({ length: 20 }, (_, i) => `<rect class="ln thin" x="${28 + i * 20}" y="66" width="9" height="7" rx="1"/><rect class="ln thin" x="${28 + i * 20}" y="157" width="9" height="7" rx="1"/>`).join('');
    const frames = Array.from({ length: 8 }, (_, i) => `<rect class="ln paper" x="${30 + i * 48}" y="80" width="42" height="70"/>${label(51 + i * 48, 119, i < 7 ? String(i + 1) : 'N', 'mid b')}`).join('');
    return svg(
      `<rect class="ln" x="20" y="58" width="400" height="114"/>${holes}${frames}`
      + '<path class="ln" d="M30 188V196H414V188"/>' + label(222, 212, '1 SECOND', 'mid b')
      + label(222, 40, 'FPS = N ÷ 1 S', 'mid big'),
    );
  },

  scope: () => {
    const grid = [1, 2, 3, 4, 5].map((i) => `<path class="ln dot thin" d="M${84 + i * 46} 38V196"/>`).join('')
      + [1, 2, 3].map((i) => `<path class="ln dot thin" d="M84 ${38 + i * 40}H360"/>`).join('');
    return svg(
      '<rect class="ln" x="60" y="16" width="324" height="204" rx="18"/>'
      + `<rect class="ln" x="84" y="38" width="276" height="158" rx="10"/>${grid}`
      + '<path class="ln" d="M120 160C130 90 190 70 220 110S300 170 320 90"/><circle class="fill" cx="320" cy="90" r="4"/>'
      + '<rect class="ln paper" x="96" y="46" width="34" height="14" rx="7"/>' + label(113, 56, 'LIVE', 'mid b')
      + '<rect class="ln paper" x="292" y="46" width="58" height="14" rx="7"/>' + label(321, 56, 'LAST 10 S', 'mid b')
      + '<path class="ln thin" d="M320 90L410 30"/>' + label(412, 26, 'TRACE', 'end b')
      + '<path class="ln thin" d="M62 120H20"/>' + label(18, 112, 'BEZEL'),
    );
  },

  gauge: () => {
    const ticks = Array.from({ length: 11 }, (_, i) => {
      const a = Math.PI + (i / 10) * Math.PI;
      const r1 = i % 5 ? 116 : 104;
      return `<path class="ln${i % 5 ? ' thin' : ''}" d="M${(220 + Math.cos(a) * r1).toFixed(1)} ${(196 + Math.sin(a) * r1).toFixed(1)}L${(220 + Math.cos(a) * 130).toFixed(1)} ${(196 + Math.sin(a) * 130).toFixed(1)}"/>`;
    }).join('');
    const needle = Math.PI + 0.65 * Math.PI;
    return svg(
      `<path class="ln" d="M80 196A140 140 0 0 1 360 196Z"/>${ticks}`
      + `<path class="ln" d="M220 196L${(220 + Math.cos(needle) * 112).toFixed(1)} ${(196 + Math.sin(needle) * 112).toFixed(1)}"/><circle class="fill" cx="220" cy="196" r="6"/>`
      + label(98, 190, '0', 'mid b') + label(220, 54, '50', 'mid b') + label(342, 190, '100', 'mid b')
      + label(220, 222, '1 STEP = 30 PX/S', 'mid'),
    );
  },

  health: () => {
    const segs = Array.from({ length: 12 }, (_, i) => `<rect class="ln${i < 10 ? ' fill' : ''}" x="${32 + i * 32}" y="86" width="24" height="54" rx="2"/>`).join('');
    return svg(
      segs
      + '<path class="ln thin" d="M32 152V158H56V152"/>' + label(44, 174, '5 FPS', 'mid')
      + '<path class="ln" d="M32 194V200H408V194"/>' + label(220, 216, '12 SEGMENTS = 60 FPS = FULL', 'mid b')
      + label(220, 58, '> 99.99 %', 'mid big'),
    );
  },

  iso: () => {
    const front = 'M70 92H300V238H70Z';
    const top = 'M70 92L132 56H362L300 92Z';
    const side = 'M300 92L362 56V202L300 238Z';
    const panels = [0, 1, 2, 3].map((i) => `<path class="ln thin" d="M82 ${150 + i * 21}H180"/>`).join('')
      + [0, 1, 2].map((i) => `<path class="ln thin" d="M192 ${132 + i * 18}H288"/>`).join('');
    const knobs = [0, 1, 2, 3, 4].map((i) => `<circle class="ln thin" cx="${92 + i * 14}" cy="140" r="3.5"/>`).join('');
    const vents = [0, 1, 2, 3, 4, 5].map((i) => `<path class="ln thin" d="M316 ${118 + i * 12}L346 ${100 + i * 12}"/>`).join('');
    return svg(
      `<path class="ln paper" d="${top}"/><path class="ln paper" d="${side}"/><path class="ln paper" d="${front}"/>`
      + '<rect class="ln" x="82" y="102" width="206" height="22" rx="2"/>'
      + '<path class="ln thin" d="M96 113H274"/>'
      + '<rect class="ln" x="82" y="130" width="98" height="98" rx="2"/><rect class="ln" x="190" y="130" width="98" height="98" rx="2"/>'
      + `${panels}${knobs}${vents}`
      + '<rect class="ln" x="200" y="186" width="78" height="34" rx="4"/>'
      + '<ellipse class="ln paper" cx="150" cy="64" rx="16" ry="9"/><path class="ln paper" d="M276 70L300 56H340L316 70Z"/>'
      + '<path class="ln thin" d="M185 113L150 26"/>' + callout(150, 20, '1')
      + '<path class="ln thin" d="M130 200L36 200"/>' + callout(28, 200, '2')
      + '<path class="ln thin" d="M260 203L410 236"/>' + callout(418, 238, '3')
      + '<path class="ln thin" d="M340 140L404 140"/>' + callout(412, 140, '4')
      + '<path class="ln thin" d="M150 64L60 40"/>' + callout(52, 38, '5')
      + '<path class="ln thin" d="M318 63L398 40"/>' + callout(406, 38, '6'),
    440, 262);
  },
};

export function figure(kind) {
  return (FIGS[kind] ?? FIGS.flow)();
}
