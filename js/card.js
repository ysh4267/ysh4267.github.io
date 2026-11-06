import { GITHUB } from './github-data.js?v=a9bb7d24f0';
import { readStore, writeStore } from './dom.js?v=a9bb7d24f0';
import { drawIcon, namedIcon } from './motion.js?v=a9bb7d24f0';

/**
 * 배경의 GitHub 카드. 포인터가 닿는 범위 안에서 카드는 스프링으로 기울고, 조명은 따로 따라온다.
 * 화면 왼쪽 수식은 이 파일의 동작을 그대로 적은 것이다. 값을 고치면 index.html 의 수식도 고친다.
 */
const CARD_W = 236;
const CARD_H = 292;
const REACH = 120;
const LIMIT = 1.8; // |x| ≤ 1.8
const TILT_PER_UNIT = 10; // θ = 10° · x
const K = 237.6;
const ZETA = 7.5;
const OMEGA = Math.sqrt(K - ZETA * ZETA); // 13.47 rad/s
const MAX_DT = 0.064;
const LIGHT_HELD = 0.4;
const LIGHT_HOME = 0.8;
const LIT_IN = 0.18;
const LIT_OUT = 0.26;
const SUN_RADIUS = 220;
const REST_ROTATION = -2.2; // 쉴 때도 카드는 평면으로 살짝 돌아가 있다.
const EDGE_DEPTH = 6; // 기울 때 보이는 카드 옆면 두께
const CENTER_X = 498.5; // 장면 좌표에서 카드 중심
const CENTER_Y = 353;
const WIDE_MIN = 1060; // 이보다 넓으면 장면 전체 폭을 기준으로 맞춘다.
const NARROW_MIN = 540; // 이보다 좁으면 카드 주변 폭을 기준으로 맞춘다.
const SMALL_DESIGN = 300;
const SIDE_GUTTER = 20;
const IS_IOS = CSS.supports('-webkit-touch-callout', 'none'); // os.css 의 iOS 경량화와 같은 조건
const RANKS_LEFT = 464;
const RANKS_WIDTH = 253;
const STRIP_CELLS = 61; // 약 두 달
const STRIP_GAP = 7;
const STRIP_PITCH = 9 + STRIP_GAP;
// 맨 위 순위는 사용자가 직접 정한 점수다. GitHub 에서 읽어 오지 않으니 바꾸려면 여기를 고친다.
const RANKS = [['C#', 6], ['Unity', 6], ['C++', 4], ['Python', 3], ['Other', 1]];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const signed = (value, digits = 2) => {
  const text = Math.abs(value).toFixed(digits);
  return `${value < 0 && Number(text) !== 0 ? '-' : '+'}${text}`;
};

/** 밑감쇠 스프링을 dt 만큼 정확한 해로 진행한다. 프레임이 떨어져도 궤적이 틀어지지 않는다. */
function stepSpring(state, target, dt) {
  const d = state.x - target;
  const cos = Math.cos(OMEGA * dt);
  const sin = Math.sin(OMEGA * dt);
  const decay = Math.exp(-ZETA * dt);
  const b = (state.v + ZETA * d) / OMEGA;
  state.x = target + decay * (d * cos + b * sin);
  state.v = decay * (-ZETA * (d * cos + b * sin) + OMEGA * (b * cos - d * sin));
}

/** 임계 감쇠: 넘치지 않고 T 초 안에 목표에 닿는다. */
function stepCritical(state, target, dt, settle) {
  const w = 5.83 / settle;
  const d = state.x - target;
  const decay = Math.exp(-w * dt);
  const c = state.v + w * d;
  state.x = target + (d + c * dt) * decay;
  state.v = (state.v - w * c * dt) * decay;
}

function ordinal(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
}

function fillCard() {
  const set = (id, text) => {
    document.getElementById(id).textContent = text;
  };
  set('c-since', String(GITHUB.since));
  set('c-count', `${GITHUB.publicRepos} PUBLIC REPOS SO FAR`);
  set('c-name', GITHUB.name);

  const visits = readStore('hoos.visits', 0) + 1;
  writeStore('hoos.visits', visits);
  set('c-note', visits === 1 ? 'First time here. Thanks.' : `Back for the ${ordinal(visits)} time. Thanks.`);

  const latestDay = GITHUB.days.at(-1)[0];
  set('c-rev', `REV. ${latestDay.slice(0, 7).replace('-', '.')} · HELLO FROM HOON`);

  fillRanks();
  fillStrip();
}

/** 맨 위 순위. 막대 길이는 1등을 기준으로 한다. */
function fillRanks() {
  const list = document.getElementById('ranks');
  const peak = Math.max(...RANKS.map(([, count]) => count));
  RANKS.forEach(([name, count], index) => {
    const row = document.createElement('li');
    const part = (className, text) => {
      const el = document.createElement('span');
      el.className = className;
      el.textContent = text;
      return el;
    };
    const bar = part('rank-bar', '');
    const fill = document.createElement('i');
    fill.style.width = `${(count / peak) * 100}%`;
    bar.append(fill);
    row.append(part('rank-no', String(index + 1).padStart(2, '0')), part('rank-name', name), bar, part('rank-count', String(count)));
    list.append(row);
  });
}

const lastDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * 약 두 달 치 활동. 이번 달 마지막 날에서 끝나므로 오른쪽 칸들이 이번 달이고, 오늘 뒤의 빈 칸이 이번 달 남은 날이다.
 * 지난날은 활동 있으면 채운 칸, 유난히 많으면 동그라미, 없으면 옅은 칸이다. 오늘은 보는 사람의 시계로 정한다.
 */
function fillStrip() {
  const strip = document.getElementById('strip');
  const counts = new Map(GITHUB.days);
  const active = GITHUB.days.map(([, count]) => count).filter(Boolean).sort((a, b) => b - a);
  const busy = active[Math.floor(active.length * 0.12)] ?? Infinity;
  const now = new Date();
  const today = dayKey(now);
  const end = lastDayOfMonth(now);
  for (let back = STRIP_CELLS - 1; back >= 0; back -= 1) {
    const day = dayKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() - back));
    const count = counts.get(day) ?? 0;
    const cell = document.createElement('i');
    const [, month, date] = day.split('-').map(Number);
    if (day > today) {
      cell.className = 'ahead';
    } else {
      const activity = !counts.has(day) ? '기록 없음' : count > 0 ? `활동 ${count}회` : '활동 없음';
      cell.dataset.tip = `${day === today ? '오늘' : `${month}월 ${date}일`} · ${activity}`;
      if (day === today) cell.className = 'today';
      else if (count >= busy) cell.className = 'on busy';
      else if (count > 0) cell.className = 'on';
    }
    strip.append(cell);
  }
}

/** 활동 칸의 이름표. 하나를 옮겨 다니며 날짜와 횟수를 보여 준다. 앞으로 올 날에는 뜨지 않는다. 터치에서는 손을 뗀 뒤에도 잠시 남는다. */
function initStripTip() {
  const strip = document.getElementById('strip');
  const tip = document.createElement('div');
  tip.className = 'strip-tip';
  tip.setAttribute('aria-hidden', 'true');
  strip.after(tip);
  let hideTimer = null;

  const show = (cell) => {
    clearTimeout(hideTimer);
    const appearing = !tip.classList.contains('on');
    tip.textContent = cell.dataset.tip;
    const half = tip.offsetWidth / 2;
    const center = strip.offsetLeft + cell.offsetLeft + cell.offsetWidth / 2;
    // 처음 나타날 때는 제자리에 바로 놓고, 그다음부터 미끄러진다. 양 끝에서는 줄 밖으로 나가지 않게 막는다.
    if (appearing) tip.style.transition = 'none';
    tip.style.setProperty('--x', `${clamp(center, strip.offsetLeft + half, strip.offsetLeft + strip.offsetWidth - half)}px`);
    if (appearing) {
      void tip.offsetWidth;
      tip.style.transition = '';
    }
    tip.classList.add('on');
  };

  strip.addEventListener('pointerover', (event) => {
    if (event.target.tagName !== 'I') return;
    if (event.target.dataset.tip) {
      show(event.target);
    } else {
      clearTimeout(hideTimer);
      tip.classList.remove('on');
    }
  });
  strip.addEventListener('pointerleave', (event) => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => tip.classList.remove('on'), event.pointerType === 'mouse' ? 80 : 1600);
  });
}

/**
 * 칸을 좁히지 않고 폭에 들어가는 만큼만 보여 준다. 이번 달이 다 들어가면 이번 달 끝에 맞춘다.
 * 안 들어가면 오늘을 왼쪽에서 5분의 4 지점에 두어 오른쪽 빈 칸을 거의 남기지 않는다. 월말에는 남은 날만큼만 남는다.
 */
function fitStrip(span) {
  const cells = [...document.getElementById('strip').children];
  const fits = Math.min(cells.length, Math.floor((span + STRIP_GAP) / STRIP_PITCH));
  const todayIndex = cells.findIndex((cell) => cell.classList.contains('today'));
  const daysLeft = cells.length - 1 - todayIndex;
  const wholeMonth = fits >= lastDayOfMonth(new Date()).getDate();
  const after = wholeMonth ? daysLeft : Math.min(daysLeft, Math.round((fits - 1) / 5));
  const lastShown = todayIndex + after;
  cells.forEach((cell, index) => {
    cell.hidden = index > lastShown || index <= lastShown - fits;
  });
}

/** 새 사진을 다 받은 뒤에 바꿔서 카드 그림이 깜빡이지 않게 한다. */
function showAvatar(url) {
  const next = new Image();
  next.onload = () => {
    document.querySelector('.art img').src = next.src;
  };
  next.src = `${url}&s=512`;
}

/** 공개 저장소 수와 프로필 사진을 GitHub 에서 다시 읽어 온다. 실패하면 구워 둔 숫자와 사본을 그대로 쓴다. */
async function refreshFromGitHub() {
  try {
    const cached = readStore('hoos.github', null);
    let live = cached;
    if (!cached?.avatarUrl || Date.now() - cached.at > 3600000) {
      const response = await fetch(`https://api.github.com/users/${GITHUB.login}`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) return;
      const profile = await response.json();
      live = { at: Date.now(), publicRepos: profile.public_repos, avatarUrl: profile.avatar_url };
      writeStore('hoos.github', live);
    }
    document.getElementById('c-count').textContent = `${live.publicRepos} PUBLIC REPOS SO FAR`;
    showAvatar(live.avatarUrl);
  } catch {
    // 네트워크가 막혀도 카드는 구워 둔 숫자로 보인다.
  }
}

/**
 * 화면 폭에 맞춰 장면을 배치한다. 높이가 모자라면 줄이지 않고 페이지처럼 스크롤한다.
 * 폭이 좁으면 카드가 그대로 크게 보이도록 카드 폭만 기준으로 삼고, 양옆의 수식과 수치는 잘린 채로 둔다.
 */
function fitScene() {
  const scene = document.getElementById('scene');
  const inner = document.getElementById('scene-inner');
  const width = scene.clientWidth;
  const wide = width >= WIDE_MIN;
  const small = width < NARROW_MIN;
  const scale = Math.min(1, width / (wide ? 998 : small ? SMALL_DESIGN : NARROW_MIN));
  inner.style.setProperty('--fit', scale.toFixed(4));
  const span = Math.min(998, Math.round((width - SIDE_GUTTER * 2) / scale));
  inner.style.setProperty('--span', `${span}px`);
  // 순위 목록은 장면 중심보다 오른쪽 자리를 지키되, 폭이 좁으면 숫자가 잘리지 않을 만큼만 안으로 들어온다.
  inner.style.setProperty('--ranks-left', `${Math.min(RANKS_LEFT, 499 + width / scale / 2 - RANKS_WIDTH - 8)}px`);
  fitStrip(span);
}

/** GitHub 버튼의 아이콘. 평소에는 화살표이고 포인터를 올리면 GitHub 아이콘으로 바뀐다. 나타날 때마다 선이 그려진다. */
function initClaim() {
  const claim = document.querySelector('.claim');
  const arrow = namedIcon('arrow-up-right', 17);
  const github = namedIcon('github', 17);
  let current = arrow;
  claim.querySelector('.spec').before(arrow);
  drawIcon(arrow, { delay: 400, duration: 620 });

  const swapTo = (next) => {
    if (current === next) return;
    current.replaceWith(next);
    current = next;
    drawIcon(next, { duration: 480 });
  };
  claim.addEventListener('pointerenter', () => swapTo(github));
  claim.addEventListener('pointerleave', () => swapTo(arrow));
}

/**
 * 오른쪽 아래의 서울 시각. 보는 사람의 시간대와 상관없이 한국 시간을 0.01초까지 보여 준다.
 * 한국은 일광 절약 시간이 없어 항상 UTC+9 이다. 탭이 숨겨지면 requestAnimationFrame 과 함께 멈춘다.
 */
function initClock() {
  const clock = document.getElementById('c-clock');
  const KST = 9 * 60 * 60 * 1000;
  const write = (length) => {
    clock.textContent = new Date(Date.now() + KST).toISOString().slice(11, length);
  };
  // 움직임을 줄이는 설정에서는 1초 단위로만 바꾼다.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    write(19);
    setInterval(() => write(19), 1000);
    return;
  }
  // 아이폰과 아이패드에서는 쉬지 않고 다시 그리지 않도록 0.1초마다 바꾼다.
  const step = IS_IOS ? 100 : 0;
  let last = 0;
  const tick = (now) => {
    if (now - last >= step) {
      write(22);
      last = now;
    }
    requestAnimationFrame(tick);
  };
  write(22);
  requestAnimationFrame(tick);
}

export function initCard() {
  fillCard();
  initClaim();
  initClock();
  initStripTip();
  refreshFromGitHub();
  fitScene();
  window.addEventListener('resize', fitScene);

  const card = document.getElementById('card');
  const ghost = document.getElementById('ghost');
  const aimRing = document.getElementById('aim-ring');
  const stateDot = document.getElementById('state-dot');
  const link = document.getElementById('aim-link');
  const sun = document.getElementById('sun');
  const overlay = document.querySelector('.overlay');
  const out = {
    tx: document.getElementById('t-tx'),
    ty: document.getElementById('t-ty'),
    aim: document.getElementById('t-aim'),
    x: document.getElementById('t-x'),
    v: document.getElementById('t-v'),
    light: document.getElementById('t-light'),
    lit: document.getElementById('t-lit'),
    state: document.getElementById('t-state'),
  };
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 처음 열릴 때 카드가 살짝 기운 채로 시작해 스프링으로 제자리를 찾는다.
  const sx = { x: still.matches ? 0 : -1.25, v: 0 };
  const sy = { x: still.matches ? 0 : 0.7, v: 0 };
  const lightX = { x: 0, v: 0 };
  const lightY = { x: 0, v: 0 };
  const aim = { x: 0, y: 0 };
  const inner = document.getElementById('scene-inner');
  // 조명이 가운데로 돌아와도 테두리 빛과 해가 튀지 않도록 마지막 방향을 기억한다.
  const facing = { x: Math.cos((-115 * Math.PI) / 180), y: Math.sin((-115 * Math.PI) / 180) };
  let held = false;
  let lit = 0;
  let last = null;
  let frame = null;

  const render = () => {
    const thetaX = TILT_PER_UNIT * sy.x;
    const thetaY = -TILT_PER_UNIT * sx.x;
    const length = Math.hypot(lightX.x, lightY.x);
    if (length > 0.02) {
      facing.x = lightX.x / length;
      facing.y = lightY.x / length;
    }
    const lightPercentX = clamp(50 + 50 * lightX.x, 0, 100);
    const lightPercentY = clamp(50 + 50 * lightY.x, 0, 100);

    card.style.transform = `rotateZ(${REST_ROTATION}deg) rotateX(${thetaX.toFixed(3)}deg) rotateY(${thetaY.toFixed(3)}deg)`;
    card.style.setProperty('--lx', `${lightPercentX.toFixed(1)}%`);
    card.style.setProperty('--ly', `${lightPercentY.toFixed(1)}%`);
    card.style.setProperty('--lit', lit.toFixed(3));
    card.style.setProperty('--la', `${((Math.atan2(facing.y, facing.x) * 180) / Math.PI + 90).toFixed(1)}deg`);
    inner.style.setProperty('--live', lit.toFixed(3));
    // 그림자는 조명 반대쪽으로, 많이 기울수록 멀리 떨어진다.
    card.style.setProperty('--sx', `${(-facing.x * lit * (6 + Math.abs(thetaY) * 0.7)).toFixed(2)}px`);
    card.style.setProperty('--sy', `${(14 - facing.y * lit * (6 + Math.abs(thetaX) * 0.7)).toFixed(2)}px`);
    // 다가온 쪽 옆면이 보인다. 오른쪽이 들리면 오른쪽 옆면, 위쪽이 들리면 위쪽 옆면이다.
    card.style.setProperty('--ex', `${(-Math.sin((thetaY * Math.PI) / 180) * EDGE_DEPTH).toFixed(2)}px`);
    card.style.setProperty('--ey', `${(Math.sin((thetaX * Math.PI) / 180) * EDGE_DEPTH).toFixed(2)}px`);

    const ax = CENTER_X + aim.x * (CARD_W / 2);
    const ay = CENTER_Y + aim.y * (CARD_H / 2);
    const dx = CENTER_X + sx.x * (CARD_W / 2);
    const dy = CENTER_Y + sy.x * (CARD_H / 2);
    aimRing.setAttribute('cx', ax);
    aimRing.setAttribute('cy', ay);
    stateDot.setAttribute('cx', dx);
    stateDot.setAttribute('cy', dy);
    link.setAttribute('x1', ax);
    link.setAttribute('y1', ay);
    link.setAttribute('x2', dx);
    link.setAttribute('y2', dy);
    document.getElementById('markers').style.opacity = lit.toFixed(3);
    sun.setAttribute('transform', `translate(${(CENTER_X + facing.x * SUN_RADIUS).toFixed(2)} ${(CENTER_Y + facing.y * SUN_RADIUS).toFixed(2)})`);
    sun.style.opacity = lit.toFixed(3);
    // 카드 위를 덮는 큰 층이라 아이폰과 아이패드에서는 쉬는 동안 아예 그리지 않아 메모리를 아낀다.
    if (IS_IOS) overlay.style.visibility = lit > 0.002 ? 'visible' : 'hidden';

    out.tx.textContent = `${signed(thetaX)}°`;
    out.ty.textContent = `${signed(thetaY)}°`;
    out.aim.textContent = held ? `${signed(aim.x)}  ${signed(aim.y)}` : `${signed(0)}  ${signed(0)}`;
    out.x.textContent = `${signed(sx.x)}  ${signed(sy.x)}`;
    out.v.textContent = `${signed(sx.v, 1)}  ${signed(sy.v, 1)}`;
    out.light.textContent = `${Math.round(lightPercentX)}%  ${Math.round(lightPercentY)}%`;
    out.lit.textContent = lit.toFixed(2);
    out.state.textContent = held ? 'held' : 'let go';
  };

  const settled = () => !held
    && Math.abs(sx.x) < 0.0005 && Math.abs(sy.x) < 0.0005
    && Math.abs(sx.v) < 0.005 && Math.abs(sy.v) < 0.005
    && Math.abs(lightX.x) < 0.001 && Math.abs(lightY.x) < 0.001
    && lit < 0.002;

  const tick = (now) => {
    frame = null;
    const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, MAX_DT);
    last = now;

    const targetX = held ? aim.x : 0;
    const targetY = held ? aim.y : 0;
    // 조명은 카드 안쪽 범위(±1)까지만 따라가고, 놓으면 가운데로 돌아온다.
    const lightTargetX = held ? clamp(aim.x, -1, 1) : 0;
    const lightTargetY = held ? clamp(aim.y, -1, 1) : 0;

    if (still.matches) {
      sx.x = targetX;
      sy.x = targetY;
      sx.v = 0;
      sy.v = 0;
      lightX.x = lightTargetX;
      lightY.x = lightTargetY;
      lit = held ? 1 : 0;
    } else {
      stepSpring(sx, targetX, dt);
      stepSpring(sy, targetY, dt);
      const settle = held ? LIGHT_HELD : LIGHT_HOME;
      stepCritical(lightX, lightTargetX, dt, settle);
      stepCritical(lightY, lightTargetY, dt, settle);
      const tau = held ? LIT_IN : LIT_OUT;
      lit += ((held ? 1 : 0) - lit) * (1 - Math.exp(-dt / tau));
    }
    render();

    if (settled()) {
      last = null;
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (frame === null) frame = requestAnimationFrame(tick);
  };

  const release = () => {
    if (held) {
      held = false;
      wake();
    }
  };

  window.addEventListener('pointermove', (event) => {
    // 창이나 사이드바 위에 있을 때는 카드가 포인터를 따라가지 않는다.
    if (event.target.closest?.('.win, #sidebar, .launcher')) {
      release();
      return;
    }
    const box = ghost.getBoundingClientRect();
    const scale = box.width / CARD_W;
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    const inReach = Math.abs(dx) <= (CARD_W / 2 + REACH) * scale && Math.abs(dy) <= (CARD_H / 2 + REACH) * scale;
    if (!inReach) {
      release();
      return;
    }
    aim.x = clamp(dx / ((CARD_W / 2) * scale), -LIMIT, LIMIT);
    aim.y = clamp(dy / ((CARD_H / 2) * scale), -LIMIT, LIMIT);
    held = true;
    wake();
  });
  document.documentElement.addEventListener('pointerleave', release);
  window.addEventListener('blur', release);

  render();
  wake();
}
