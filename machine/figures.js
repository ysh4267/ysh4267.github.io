// 설명서 페이지의 그림과 7세그먼트 표시용 좌표.

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

// 설명서 그림은 레퍼런스 설명서처럼 그린 선 그림 이미지다(fig/). 잉크만 있고 바탕은 투명해서 종이 색이 비친다.
// 표지 그림(iso)은 레퍼런스 표지처럼 겉판이 유리로 비치는 기계 전체를 그린 벡터 그림이고, 나머지는 같은 크기의 틀에 맞춘 이미지다.
const FIG_FILES = { iso: ['iso.svg', 868, 840] };
const FIG_KINDS = new Set(['iso', 'flow', 'trail', 'lcd', 'chart', 'bars', 'printer', 'receipt', 'clock', 'mouse', 'film', 'scope', 'gauge', 'health']);

/** 그림 종류에 맞는 이미지 태그. 이 파일에 적힌 이름만 쓰므로 바깥 값이 주소에 들어가지 않는다. */
export function figure(kind) {
  const name = FIG_KINDS.has(kind) ? kind : 'flow';
  const [file, w, h] = FIG_FILES[name] ?? [`${name}.webp`, 860, 540];
  return `<img class="fig-img" src="fig/${file}" width="${w}" height="${h}" alt="" decoding="async" draggable="false">`;
}
