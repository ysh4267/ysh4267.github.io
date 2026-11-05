const PROPERTIES = new Set(['value', 'checked', 'disabled', 'hidden', 'title', 'type', 'name', 'href', 'target', 'rel', 'src', 'placeholder', 'tabIndex']);

/** 작은 DOM 생성 도우미. 문자열은 항상 텍스트로 넣으므로 카탈로그 값이 HTML로 해석되지 않는다. */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style') el.style.cssText = value; // CSP 가 인라인 style 속성을 막아도 동작한다.
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (PROPERTIES.has(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined && child !== false) el.append(child);
  }
  return el;
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

export function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장소가 막힌 브라우저에서도 화면은 그대로 동작한다.
  }
}
