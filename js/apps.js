import { h } from './dom.js?v=017ca12b3a';
import { drawIcon, namedIcon } from './motion.js?v=017ca12b3a';
import { WEB_APPS } from './tools.js?v=017ca12b3a';
import { closeOtherWindows, isOpen, openWindow, toggleWindow } from './wm.js?v=017ca12b3a';

const IFRAME_ALLOW = 'clipboard-read; clipboard-write; fullscreen; gamepad; autoplay';

// 도구는 비밀 코드로 풀기 전까지 비어 있다.
let tools = [];
const toolListeners = new Set();

export const toolApps = () => tools;
export const webApps = () => WEB_APPS;
export const allApps = () => [...WEB_APPS, ...tools];
export const onToolsChange = (listener) => toolListeners.add(listener);

/** 푼 도구 목록을 넣거나, 빈 목록으로 다시 숨긴다. 숨길 때는 열린 창도 닫는다. */
export function setTools(list) {
  tools = list;
  if (list.length === 0) closeOtherWindows(null);
  for (const listener of toolListeners) listener();
}

export const windowId = (app) => `app:${app.id}`;

/** 찾기 메뉴와 바로 가기 주소: 그 도구의 창을 앞으로 가져오고, 열려 있던 다른 창은 닫는다. */
export function openApp(app) {
  closeOtherWindows(windowId(app));
  if (isOpen(windowId(app))) openWindow({ id: windowId(app) });
  else if (app.url) openWebApp(app);
  else openInfo(app);
}

/** 사이드바 아이콘: 열려 있으면 숨기거나 앞으로 가져오고, 아니면 기존 창을 닫고 연다. */
export function toggleApp(app) {
  if (isOpen(windowId(app))) toggleWindow(windowId(app));
  else openApp(app);
}

function openWebApp(app) {
  const frame = h('iframe', { class: 'app-frame', src: app.url, title: app.name, allow: IFRAME_ALLOW, referrerpolicy: 'no-referrer', allowfullscreen: true });
  const [width, height] = app.size ?? [1100, 720];
  const record = openWindow({
    id: windowId(app),
    title: app.name,
    iconName: app.icon,
    width,
    height,
    content: frame,
    bodyClass: 'flush',
    tools: [
      {
        icon: 'reload',
        title: '새로고침',
        onClick: () => {
          frame.classList.remove('loaded');
          record.setBusy(true);
          frame.src = app.url;
        },
      },
      { icon: 'external', title: '새 탭에서 열기', onClick: () => window.open(app.url, '_blank', 'noopener') },
    ],
  });
  record.setBusy(true);
  frame.addEventListener('load', () => {
    frame.classList.add('loaded');
    record.setBusy(false);
  });
}

function openInfo(app) {
  const glyph = namedIcon(app.icon, 28);
  const notes = (app.links ?? []).filter((link) => link.note).map((link) => h('p', { class: 'field-note', text: link.note }));
  const content = h('div', { class: 'sheet' },
    h('header', { class: 'sheet-head' },
      h('span', { class: 'tile' }, glyph),
      h('div', { class: 'sheet-title' }, h('h2', { text: app.name }), h('p', { class: 'summary', text: app.summary })),
    ),
    h('dl', { class: 'facts' },
      h('dt', { text: '종류' }), h('dd', { text: app.kind }),
      h('dt', { text: '쓰는 법' }), h('dd', { text: app.how }),
    ),
    app.links?.length
      ? h('div', { class: 'actions' }, app.links.map((link, index) => h('a', {
        class: `btn${index === 0 ? ' primary' : ''}`,
        href: link.href,
        target: '_blank',
        rel: 'noopener',
        text: link.label,
      })))
      : null,
    notes,
  );
  openWindow({ id: windowId(app), title: app.name, iconName: app.icon, width: 480, height: 340, content });
  drawIcon(glyph, { duration: 760 });
}
