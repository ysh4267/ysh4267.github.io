import { allApps, openApp, setTools } from './apps.js?v=e123869de2';
import { initCard } from './card.js?v=e123869de2';
import { restoreTools } from './lock.js?v=e123869de2';
import { initRail } from './rail.js?v=e123869de2';
import { clearActive, initWindows } from './wm.js?v=e123869de2';

initWindows(document.getElementById('windows'));
initRail(document.getElementById('sidebar'));
initCard();

// 설계도를 누르면 어떤 창도 활성이 아닌 상태가 된다.
document.getElementById('scene').addEventListener('pointerdown', clearActive);

// 이 브라우저에서 비밀 코드를 넣은 적이 있으면 도구를 다시 보여 준다.
const remembered = await restoreTools();
if (remembered) setTools(remembered);

// 주소 뒤에 #도구id 를 붙이면 그 도구를 바로 연다(즐겨찾기용).
const linked = decodeURIComponent(window.location.hash.slice(1));
const app = allApps().find((candidate) => candidate.id === linked);
if (app) openApp(app);
