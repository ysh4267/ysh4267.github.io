import { onToolsChange, toggleApp, toolApps, webApps, windowId } from './apps.js?v=a9bb7d24f0';
import { h } from './dom.js?v=a9bb7d24f0';
import { toggleLauncher } from './launcher.js?v=a9bb7d24f0';
import { drawIcon, namedIcon, pulseRing } from './motion.js?v=a9bb7d24f0';
import { isActive, isOpen, onWindowsChange } from './wm.js?v=a9bb7d24f0';

/**
 * 왼쪽 사이드바. 얇은 선 아이콘이 세로로 놓이고, 이름표 하나가 아이콘 사이를 미끄러져 다닌다.
 * 이름표를 항목마다 따로 띄우지 않고 하나를 옮겨야 글자가 굴러 바뀌는 움직임이 나온다.
 */
const TIP_HIDE_DELAY = 90;

const prefersStill = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const tipLine = (name) => h('div', { class: 'tip-line' }, h('span', { text: name }));

function createTip() {
  const el = h('div', { class: 'tip', role: 'tooltip', 'aria-hidden': 'true' });
  document.body.append(el);
  let current = null;
  let lastY = 0;
  let hideTimer = null;

  return {
    show(button, name) {
      clearTimeout(hideTimer);
      const box = button.getBoundingClientRect();
      const y = box.top + box.height / 2;
      const line = tipLine(name);
      el.append(line);
      const width = line.offsetWidth;

      if (!el.classList.contains('on')) {
        // 처음 나타날 때는 제자리에서 바로 보이게 하고, 그다음부터 미끄러진다.
        el.style.transition = 'none';
        el.style.left = `${box.right + 8}px`;
        el.style.width = `${width}px`;
        el.style.setProperty('--y', `${y}px`);
        current?.remove();
        void el.offsetWidth;
        el.style.transition = '';
        el.classList.add('on');
      } else {
        el.style.width = `${width}px`;
        el.style.setProperty('--y', `${y}px`);
        if (current && !prefersStill()) {
          const direction = y > lastY ? 1 : -1;
          const leaving = current;
          leaving
            .animate(
              [
                { transform: 'translateY(0)', opacity: 1 },
                { transform: `translateY(${-direction * 100}%)`, opacity: 0 },
              ],
              { duration: 210, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' },
            )
            .finished.finally(() => leaving.remove());
          line.animate(
            [
              { transform: `translateY(${direction * 100}%)`, opacity: 0 },
              { transform: 'translateY(0)', opacity: 1 },
            ],
            { duration: 210, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' },
          );
        } else {
          current?.remove();
        }
      }
      current = line;
      lastY = y;
    },
    hide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => el.classList.remove('on'), TIP_HIDE_DELAY);
    },
  };
}

export function initRail(host) {
  const tip = createTip();
  const buttons = new Map();
  const everyGlyph = [];

  const makeButton = (name, iconName, onActivate) => {
    const glyph = namedIcon(iconName, 20);
    everyGlyph.push(glyph);
    const button = h('button', {
      class: 'rail-btn',
      type: 'button',
      'aria-label': name,
      onClick: () => {
        pulseRing(button);
        onActivate();
      },
      onPointerenter: () => {
        tip.show(button, name);
        drawIcon(glyph, { duration: 480 });
      },
      onPointerleave: () => tip.hide(),
      onFocus: (event) => {
        if (event.target.matches(':focus-visible')) tip.show(button, name);
      },
      onBlur: () => tip.hide(),
    }, glyph);
    return button;
  };

  const appButton = (app) => {
    const button = makeButton(app.name, app.icon, () => toggleApp(app));
    buttons.set(app, button);
    return button;
  };

  const sync = () => {
    for (const [app, button] of buttons) {
      const id = windowId(app);
      button.classList.toggle('open', isOpen(id));
      button.classList.toggle('active', isActive(id));
    }
  };

  // 게임은 늘 같은 자리에 있고, 코드로 푼 도구는 그 아래에 붙는다.
  const render = () => {
    tip.hide();
    buttons.clear();
    everyGlyph.length = 0;
    const tools = toolApps();
    host.replaceChildren(h('div', { class: 'rail' },
      makeButton('찾기', 'search', toggleLauncher),
      h('div', { class: 'rail-sep' }),
      webApps().map(appButton),
      tools.length > 0 ? h('div', { class: 'rail-sep' }) : null,
      tools.map(appButton),
    ));
    sync();
    // 위에서부터 차례로 그려진다.
    everyGlyph.forEach((glyph, index) => drawIcon(glyph, { delay: 120 + index * 55, duration: 620, move: false }));
  };

  host.addEventListener('scroll', () => tip.hide());
  onWindowsChange(sync);
  onToolsChange(render);
  render();
}
