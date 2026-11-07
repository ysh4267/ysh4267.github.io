import { readStore, writeStore } from './dom.js?v=8d5b71707c';
import { LOCKED } from './locked-tools.js?v=8d5b71707c';

/**
 * 숨겨 둔 도구 목록을 비밀 코드로 푼다. 서버가 없으므로 공개 파일에는 암호문만 두고, 코드로 만든 키로 브라우저에서 복호화한다.
 * 한 번 풀면 키를 이 브라우저에 기억해서 다음 방문 때 다시 묻지 않는다.
 */
const KEY_STORE = 'hoos.tools';

// 띄어쓰기와 대소문자는 가리지 않는다. tools/seal-tools.mjs 와 같은 규칙이어야 한다.
const normalize = (code) => code.normalize('NFC').replace(/\s+/g, '').toLowerCase();
const fromBase64 = (text) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

async function decrypt(rawKey) {
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(LOCKED.iv) }, key, fromBase64(LOCKED.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

/** 코드가 맞으면 도구 목록을, 틀리면 null 을 돌려준다. */
export async function unlockTools(code) {
  try {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalize(code)), 'PBKDF2', false, ['deriveBits']);
    const rawKey = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(LOCKED.salt), iterations: LOCKED.iterations },
      material,
      256,
    );
    const tools = await decrypt(rawKey);
    writeStore(KEY_STORE, toBase64(rawKey));
    return tools;
  } catch {
    return null;
  }
}

/** 이 브라우저가 기억하는 키로 도구 목록을 푼다. 코드가 바뀌어 안 풀리면 잊어버린다. */
export async function restoreTools() {
  const saved = readStore(KEY_STORE, null);
  if (!saved) return null;
  try {
    return await decrypt(fromBase64(saved));
  } catch {
    forgetTools();
    return null;
  }
}

export function forgetTools() {
  try {
    localStorage.removeItem(KEY_STORE);
  } catch {
    // 저장소가 막힌 브라우저에는 지울 것도 없다.
  }
}
