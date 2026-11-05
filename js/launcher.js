import { allApps, openApp, setTools, toolApps } from './apps.js?v=cb35364110';
import { h } from './dom.js?v=cb35364110';
import { forgetTools, unlockTools } from './lock.js?v=cb35364110';
import { drawIcon, namedIcon } from './motion.js?v=cb35364110';

let launcher = null;

function close() {
  launcher?.remove();
  launcher = null;
}

function matches(app, query) {
  if (!query) return true;
  return `${app.name} ${app.summary ?? ''}`.toLowerCase().includes(query);
}

function open() {
  let selected = 0;
  let shown = [];
  let items = [];

  const searchGlyph = namedIcon('search', 18);
  const input = h('input', { class: 'launcher-input', type: 'search', placeholder: '이름으로 찾기', 'aria-label': '도구 찾기' });
  const list = h('div', { class: 'launcher-list', role: 'listbox', 'aria-label': '도구' });

  const choose = (app) => {
    close();
    openApp(app);
  };

  // 일치하는 이름이 없을 때만 비밀 코드인지 확인한다. 틀리면 아무 표시 없이 그대로 두고, 맞는 코드를 다시 넣으면 도로 숨긴다.
  const tryCode = async (code) => {
    if (!code.trim()) return;
    const tools = await unlockTools(code);
    if (!tools) return;
    close();
    if (toolApps().length > 0) {
      forgetTools();
      setTools([]);
    } else {
      setTools(tools);
    }
  };

  const markSelected = () => {
    items.forEach((item, index) => {
      item.classList.toggle('on', index === selected);
      item.setAttribute('aria-selected', String(index === selected));
    });
    items[selected]?.scrollIntoView({ block: 'nearest' });
  };

  const paint = () => {
    const query = input.value.trim().toLowerCase();
    shown = allApps().filter((app) => matches(app, query));
    selected = Math.min(selected, Math.max(0, shown.length - 1));
    list.replaceChildren();
    if (shown.length === 0) {
      items = [];
      list.append(h('p', { class: 'launcher-empty', text: '찾는 도구가 없어요. 다른 이름으로 찾아보세요.' }));
      return;
    }
    items = shown.map((app, index) => {
      const glyph = namedIcon(app.icon, 18);
      drawIcon(glyph, { delay: index * 28, duration: 420, move: false });
      return h('button', {
        class: 'launcher-item',
        type: 'button',
        role: 'option',
        onClick: () => choose(app),
        onPointermove: () => {
          if (selected !== index) {
            selected = index;
            markSelected();
          }
        },
      },
      h('span', { class: 'launcher-glyph' }, glyph),
      h('span', { class: 'launcher-text' },
        h('span', { class: 'launcher-name', text: app.name }),
        h('span', { class: 'launcher-summary', text: app.summary }),
      ));
    });
    list.append(...items);
    markSelected();
  };

  input.addEventListener('input', () => {
    selected = 0;
    paint();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selected = Math.min(selected + 1, shown.length - 1);
      markSelected();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selected = Math.max(selected - 1, 0);
      markSelected();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (shown[selected]) choose(shown[selected]);
      else tryCode(input.value);
    } else if (event.key === 'Escape') {
      close();
    }
  });

  launcher = h('div', { class: 'launcher' },
    h('div', { class: 'launcher-top' }, searchGlyph, input),
    list,
  );
  document.body.append(launcher);
  paint();
  input.focus();
  drawIcon(searchGlyph, { duration: 460 });
}

export function toggleLauncher() {
  if (launcher) close();
  else open();
}

document.addEventListener('pointerdown', (event) => {
  if (launcher && !launcher.contains(event.target) && !event.target.closest('.rail-btn')) close();
});
