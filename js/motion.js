import { icon } from './icons.js?v=167df14cfd';

const SHAPES = 'path, circle, rect, line, polyline, polygon, ellipse';
const DRAW_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
const MOVE_EASING = 'cubic-bezier(0.3, 0.7, 0.2, 1)';

const prefersStill = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 선이 그려지는 동안 아이콘이 그 도구답게 한 번 움직인다.
const MOTIONS = {
  keyboard: [{ transform: 'translateY(0)' }, { transform: 'translateY(1.5px)' }, { transform: 'translateY(0)' }],
  gamepad: [{ transform: 'rotate(-9deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(0)' }],
  eye: [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.12)', offset: 0.45 }, { transform: 'scaleY(1)' }],
  image: [{ transform: 'scale(0.9)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }],
  broom: [{ transform: 'rotate(-14deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }],
  'monitor-play': [{ transform: 'scale(0.92)' }, { transform: 'scale(1)' }],
  truck: [{ transform: 'translateX(-4px)' }, { transform: 'translateX(1.5px)' }, { transform: 'translateX(0)' }],
  dna: [{ transform: 'rotate(-40deg)' }, { transform: 'rotate(0)' }],
  backpack: [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }],
  box: [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-3.5px) rotate(4deg)' }, { transform: 'translateY(0) rotate(0)' }],
  'book-open': [{ transform: 'scaleX(0.82)' }, { transform: 'scaleX(1.05)' }, { transform: 'scaleX(1)' }],
  blocks: [{ transform: 'scale(0.86)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }],
  question: [{ transform: 'rotate(-8deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(0)' }],
  search: [{ transform: 'translate(-1.5px, -1.5px)' }, { transform: 'translate(0, 0)' }],
  github: [{ transform: 'rotate(-10deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(0)' }],
  'arrow-up-right': [{ transform: 'translate(-3px, 3px)' }, { transform: 'translate(0, 0)' }],
};

/** 이름을 기억하는 아이콘. drawIcon 이 도구별 움직임을 찾을 때 쓴다. */
export function namedIcon(name, size) {
  const svg = icon(name, size);
  svg.dataset.icon = name;
  return svg;
}

/**
 * 아이콘의 선을 처음부터 다시 그린다.
 * 선 길이를 1로 맞춘 뒤 점선 오프셋을 줄이는 방식이라 어떤 모양의 아이콘에도 그대로 쓸 수 있다.
 */
export function drawIcon(svg, { delay = 0, duration = 560, move = true } = {}) {
  if (!svg || prefersStill()) return;
  const shapes = [...svg.querySelectorAll(SHAPES)];
  const token = {};
  svg.drawToken = token;

  // 선을 차례로 시작해서 한 획씩 그어지는 느낌을 낸다.
  const strokeTime = duration * 0.62;
  const step = shapes.length > 1 ? (duration - strokeTime) / (shapes.length - 1) : 0;

  shapes.forEach((shape, index) => {
    for (const running of shape.getAnimations()) running.cancel();
    shape.setAttribute('pathLength', '1');
    shape.style.strokeDasharray = '1 1';
    const animation = shape.animate(
      [
        { strokeDashoffset: '1', opacity: 0 },
        { opacity: 1, offset: 0.06 },
        { strokeDashoffset: '0', opacity: 1 },
      ],
      { duration: strokeTime, delay: delay + index * step, easing: DRAW_EASING, fill: 'backwards' },
    );
    animation.finished
      .then(() => {
        // 다 그린 뒤에는 점선을 지워 둥근 선 끝이 원래대로 보이게 한다.
        if (svg.drawToken === token) shape.style.strokeDasharray = '';
      })
      .catch(() => {});
  });

  const keyframes = move ? MOTIONS[svg.dataset.icon] : null;
  if (keyframes) {
    for (const running of svg.getAnimations()) running.cancel();
    svg.style.transformBox = 'fill-box';
    svg.style.transformOrigin = 'center';
    svg.animate(keyframes, { duration: duration + 120, delay, easing: MOVE_EASING });
  }
}

/** 눌렀을 때 아이콘 칸에서 번지는 고리. */
export function pulseRing(button) {
  if (prefersStill()) return;
  const ring = document.createElement('span');
  ring.className = 'pulse';
  button.append(ring);
  ring
    .animate(
      [
        { transform: 'scale(0.72)', opacity: 0.7 },
        { transform: 'scale(1.22)', opacity: 0 },
      ],
      { duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    )
    .finished.finally(() => ring.remove());
}

/** 도구가 열리는 동안 도는 점선 고리. */
export function spinnerIcon(size = 16) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('spinner');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '9');
  circle.setAttribute('stroke-dasharray', '3.2 4.05');
  svg.append(circle);
  return svg;
}
