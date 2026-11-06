import { h, clamp, readStore, writeStore } from './dom.js?v=167df14cfd';
import { drawIcon, namedIcon, spinnerIcon } from './motion.js?v=167df14cfd';

/** 창 관리자. 제목 표시줄을 끌어 옮기고, 가장자리를 끌어 크기를 바꾼다. 위치와 크기는 도구별로 기억한다. */
const MIN_WIDTH = 300;
const MIN_HEIGHT = 180;
const ZOOM_MARGIN = 10;
const GEOMETRY_KEY = 'hoos.win';

const windows = new Map();
const listeners = new Set();
const geometry = readStore(GEOMETRY_KEY, {});
let layer = null;
let zTop = 10;
let activeId = null;

const isCompact = () => window.matchMedia('(max-width: 640px)').matches;
const prefersStill = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initWindows(element) {
  layer = element;
  window.addEventListener('resize', () => {
    for (const record of windows.values()) place(record);
  });
}

export function onWindowsChange(listener) {
  listeners.add(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

export const isOpen = (id) => windows.has(id);
export const isActive = (id) => activeId === id;

function topVisible() {
  return [...windows.values()]
    .filter((record) => !record.minimized)
    .sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex))[0];
}

function syncActive() {
  for (const record of windows.values()) record.el.classList.toggle('active', record.id === activeId);
  emit();
}

function playIn(el) {
  if (prefersStill()) return;
  el.animate(
    [
      { opacity: 0, transform: 'translateX(-10px) scale(0.985)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
}

async function playOut(el) {
  if (prefersStill()) return;
  await el.animate(
    [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateX(-10px) scale(0.985)' },
    ],
    { duration: 120, easing: 'ease-in' },
  ).finished;
}

export function focusWindow(id) {
  const record = windows.get(id);
  if (!record) return;
  if (record.minimized) {
    record.minimized = false;
    record.el.hidden = false;
    playIn(record.el);
  }
  activeId = id;
  zTop += 1;
  record.el.style.zIndex = zTop;
  syncActive();
}

export function clearActive() {
  if (activeId === null) return;
  activeId = null;
  syncActive();
}

export async function minimizeWindow(id) {
  const record = windows.get(id);
  if (!record || record.minimized) return;
  record.minimized = true;
  if (activeId === id) activeId = topVisible()?.id ?? null;
  syncActive();
  await playOut(record.el);
  if (record.minimized) record.el.hidden = true;
}

/** 사이드바 아이콘: 맨 앞이면 숨기고, 아니면 앞으로 가져온다. */
export function toggleWindow(id) {
  const record = windows.get(id);
  if (!record) return;
  if (activeId === id && !record.minimized) minimizeWindow(id);
  else focusWindow(id);
}

export async function closeWindow(id) {
  const record = windows.get(id);
  if (!record) return;
  windows.delete(id);
  if (activeId === id) activeId = topVisible()?.id ?? null;
  syncActive();
  await playOut(record.el);
  record.el.remove();
}

/** 창은 한 번에 하나만 둔다. 새 항목을 열 때 나머지를 닫는다. */
export function closeOtherWindows(id) {
  for (const otherId of [...windows.keys()]) {
    if (otherId !== id) closeWindow(otherId);
  }
}

export function zoomWindow(id) {
  const record = windows.get(id);
  if (!record) return;
  record.zoomed = !record.zoomed;
  place(record);
  saveGeometry(record);
}

function place(record) {
  const deskWidth = layer.clientWidth;
  const deskHeight = layer.clientHeight;
  const { el, rect } = record;
  el.classList.toggle('zoomed', record.zoomed);
  if (isCompact()) {
    Object.assign(el.style, { left: '0px', top: '0px', width: `${deskWidth}px`, height: `${deskHeight}px` });
    return;
  }
  if (record.zoomed) {
    Object.assign(el.style, {
      left: `${ZOOM_MARGIN}px`,
      top: `${ZOOM_MARGIN}px`,
      width: `${deskWidth - ZOOM_MARGIN * 2}px`,
      height: `${deskHeight - ZOOM_MARGIN * 2}px`,
    });
    return;
  }
  const width = clamp(rect.width, MIN_WIDTH, deskWidth - ZOOM_MARGIN * 2);
  const height = clamp(rect.height, MIN_HEIGHT, deskHeight - ZOOM_MARGIN * 2);
  // 제목 표시줄을 다시 잡을 수 있도록 일부는 항상 화면 안에 둔다.
  const left = clamp(rect.left, 60 - width, deskWidth - 60);
  const top = clamp(rect.top, 0, deskHeight - 48);
  Object.assign(el.style, {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${Math.round(width)}px`,
    height: `${Math.round(height)}px`,
  });
}

function saveGeometry(record) {
  geometry[record.id] = { ...record.rect, zoomed: record.zoomed };
  writeStore(GEOMETRY_KEY, geometry);
}

function defaultRect(width, height) {
  // 창이 하나씩만 뜨므로 항상 사이드바 옆 같은 자리에서 시작한다.
  return { left: 32, top: 44, width, height };
}

function barButton(name, title, onClick, extraClass = '') {
  const glyph = namedIcon(name, 15);
  return h('button', {
    class: `win-btn ${extraClass}`,
    type: 'button',
    title,
    'aria-label': title,
    onClick,
    onPointerenter: () => drawIcon(glyph, { duration: 340, move: false }),
  }, glyph);
}

/** 창을 연다. 이미 열려 있으면 앞으로 가져온다. */
export function openWindow({ id, title, iconName, content, width = 640, height = 460, tools = [], bodyClass = '' }) {
  const existing = windows.get(id);
  if (existing) {
    focusWindow(id);
    return existing;
  }

  const body = h('div', { class: `win-body ${bodyClass}` });
  if (content) body.append(content);

  const iconSlot = h('span', { class: 'win-icon' });
  const showIcon = () => {
    const glyph = namedIcon(iconName, 16);
    iconSlot.replaceChildren(glyph);
    drawIcon(glyph, { duration: 620 });
  };
  showIcon();

  const bar = h('header', { class: 'win-bar' },
    iconSlot,
    h('span', { class: 'win-title', text: title }),
    tools.map((tool) => barButton(tool.icon, tool.title, tool.onClick)),
    barButton('min', `${title} 숨기기`, () => minimizeWindow(id)),
    barButton('zoom', `${title} 크게`, () => zoomWindow(id)),
    barButton('close', `${title} 닫기`, () => closeWindow(id), 'close'),
  );
  const shield = h('div', { class: 'win-shield' });
  const el = h('section', { class: 'win', role: 'dialog', 'aria-label': title },
    bar,
    body,
    shield,
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((dir) => h('div', { class: `win-edge edge-${dir}`, 'data-dir': dir })),
  );

  const saved = geometry[id];
  const record = {
    id,
    title,
    el,
    body,
    minimized: false,
    zoomed: saved?.zoomed ?? false,
    rect: saved ? { left: saved.left, top: saved.top, width: saved.width, height: saved.height } : defaultRect(width, height),
    /** 내용을 불러오는 동안 제목 표시줄 아이콘이 도는 고리로 바뀐다. */
    setBusy(busy) {
      if (busy) iconSlot.replaceChildren(spinnerIcon(16));
      else showIcon();
    },
  };
  windows.set(id, record);

  el.addEventListener('pointerdown', () => {
    if (activeId !== id) focusWindow(id);
  });

  attachDrag(record, bar);
  for (const edge of el.querySelectorAll('.win-edge')) attachResize(record, edge);

  layer.append(el);
  place(record);
  focusWindow(id);
  playIn(el);
  return record;
}

function startPointerSession(event, onMove, onEnd) {
  event.preventDefault();
  const target = event.currentTarget;
  target.setPointerCapture(event.pointerId);
  document.body.classList.add('dragging');
  const move = (e) => onMove(e);
  const up = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    document.body.classList.remove('dragging');
    onEnd();
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}

function attachDrag(record, bar) {
  bar.addEventListener('dblclick', (event) => {
    if (!event.target.closest('button')) zoomWindow(record.id);
  });
  bar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button') || isCompact()) return;
    const startX = event.clientX;
    const startY = event.clientY;
    if (record.zoomed) {
      // 크게 띄운 창을 끌면 원래 크기로 돌아가며 포인터 아래에 붙는다.
      record.zoomed = false;
      const deskLeft = layer.getBoundingClientRect().left;
      record.rect.left = startX - deskLeft - record.rect.width / 2;
      record.rect.top = 0;
      place(record);
    }
    const startLeft = record.rect.left;
    const startTop = record.rect.top;
    startPointerSession(event, (e) => {
      record.rect.left = startLeft + e.clientX - startX;
      record.rect.top = startTop + e.clientY - startY;
      place(record);
    }, () => {
      record.rect.left = parseInt(record.el.style.left, 10);
      record.rect.top = parseInt(record.el.style.top, 10);
      saveGeometry(record);
    });
  });
}

function attachResize(record, edge) {
  const dir = edge.dataset.dir;
  edge.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || record.zoomed || isCompact()) return;
    const start = { ...record.rect };
    const startX = event.clientX;
    const startY = event.clientY;
    startPointerSession(event, (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const next = { ...start };
      if (dir.includes('e')) next.width = Math.max(MIN_WIDTH, start.width + dx);
      if (dir.includes('s')) next.height = Math.max(MIN_HEIGHT, start.height + dy);
      if (dir.includes('w')) {
        next.width = Math.max(MIN_WIDTH, start.width - dx);
        next.left = start.left + start.width - next.width;
      }
      if (dir.includes('n')) {
        next.height = Math.max(MIN_HEIGHT, start.height - dy);
        next.top = start.top + start.height - next.height;
      }
      record.rect = next;
      place(record);
    }, () => saveGeometry(record));
  });
}
