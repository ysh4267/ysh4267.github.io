// 누구에게나 보이는 게임 목록. 게임을 더하거나 빼려면 이 파일만 고치면 된다. 적은 순서대로 왼쪽 막대에 놓인다.
// 도구는 평소 숨겨 둔다. 원본은 tools/locked-tools.mjs 이고 여기에는 도구 이름과 주소를 적지 않는다.

/** 브라우저에서 바로 돌아가는 앱. 누르면 창 안에서 열린다. */
export const WEB_APPS = [
  {
    id: 'iknowthis',
    name: '아 이거 머더라',
    summary: '친구들과 하는 맞추기 게임',
    icon: 'question',
    url: 'https://iknowthis.vercel.app',
    size: [1100, 760],
  },
  {
    id: 'paldo',
    name: '팔도 트래픽',
    summary: '전국 도로망 위에서 트럭을 굴리고 정체를 푸는 물류 게임',
    icon: 'truck',
    url: 'https://ysh4267.github.io/paldo-traffic/',
    size: [1240, 800],
  },
  {
    id: 'primordium',
    name: 'Primordium',
    summary: 'RNA 한 가닥에서 문명까지 진화하는 인크리멘탈 게임',
    icon: 'dna',
    url: 'https://ysh4267.github.io/primordium/',
    size: [1240, 800],
  },
  {
    id: 'puzzle1010',
    name: '1010!',
    summary: '줄을 채워 지우는 블록 퍼즐',
    icon: 'blocks',
    url: 'https://1010puzzle.vercel.app/',
    size: [520, 780],
  },
  {
    id: 'escape2d',
    name: 'Escape 2D (WIP)',
    summary: '타르코프식 격자 인벤토리를 가진 탑다운 탈출 슈터',
    icon: 'backpack',
    url: 'https://ysh4267.github.io/escape-2d/',
    size: [1280, 800],
  },
  {
    id: 'box',
    name: 'Box',
    summary: '누르면 툭 소리를 내며 튀어 오르는 상자',
    icon: 'box',
    url: 'https://ysh4267.github.io/box/',
    size: [1006, 782],
  },
  {
    id: 'tutorial',
    name: 'Tutorial',
    summary: '마우스를 올리면 설명이 뜨고, 설명서를 넘기면 그 부분을 비춰 주는 기계',
    icon: 'book-open',
    url: 'tutorial/',
    size: [1280, 800],
  },
  {
    id: 'interactions',
    name: 'Interactions',
    summary: '골라 둔 인터랙션을 같은 모양, 같은 움직임으로 다시 만들어 모아 둔 페이지',
    icon: 'mouse-pointer-click',
    url: 'https://ysh4267.github.io/interactions/',
    size: [1280, 800],
  },
];
