// 시작점. 사이드바와 본문 틀을 만들고, 해시 주소가 바뀔 때마다 본문만 갈아 끼운다.
import { el } from './dom.js';
import { icon } from './icons.js';
import { hashOf, viewOf } from './route.js';
import { detectStore } from './store.js';
import { renderCalendar } from './calview.js';
import { field, openDrawer, toast } from './ui.js';

const root = document.getElementById('app');
const store = await detectStore();
const me = await store.me().catch(() => ({ email: '', name: '사용자' }));

const NAV = [
  ['home', '홈', 'home'],
  ['calendar', '캘린더', 'calendar'],
];
const links = {};

// 모드별 문구. local = 이 브라우저에만, supabase = 모두가 같은 달력(관리자만 수정), remote = Cloudflare 서버.
const MODE = {
  local: {
    badge: store.fallback ? '체험 모드 · 서버에 연결하지 못해 이 브라우저에만 저장됩니다' : '체험 모드 · 이 브라우저에만 저장됩니다',
    title: '지금은 체험 모드',
    text: store.fallback
      ? '공유 서버(Supabase)에 연결하지 못했습니다(' + store.fallback + '). 무료 프로젝트는 오래 안 쓰면 잠드니 Supabase 대시보드에서 깨운 뒤 새로고침해 보세요. 그동안은 이 브라우저에만 저장됩니다.'
      : '누구나 자유롭게 눌러 볼 수 있고, 바꾼 내용은 이 브라우저에만 남습니다. 모두가 같은 달력을 보게 하려면 assets/config.js 에 Supabase 주소와 키를 넣으세요(README 참고).',
  },
  supabase: {
    badge: me.can_edit ? '공유 모드 · 로그인됨, 바꾸면 모두에게 보입니다' : '공유 모드 · 보기 전용 (관리자만 수정)',
    title: '지금은 공유 모드',
    text: me.can_edit
      ? '일정은 Supabase 에 저장되고, 이 주소로 들어오는 사람 모두 같은 달력을 봅니다. 지금은 로그인되어 있어 추가·수정·완료 체크를 할 수 있습니다.'
      : '일정은 Supabase 에 저장되고, 누구나 볼 수 있습니다. 추가·수정·완료 체크는 왼쪽 아래 [관리자 로그인]으로 들어온 사람만 할 수 있습니다.',
  },
  remote: {
    badge: '서버 저장 모드 · 모두가 같은 달력을 봅니다',
    title: '지금은 서버 저장 모드',
    text: '일정은 Cloudflare D1 에 저장됩니다. 같은 주소로 들어오는 사람 모두 같은 달력을 봅니다.',
  },
}[store.kind] || { badge: '', title: '', text: '' };

// ---------- 로그인(공유 모드만) ----------
function loginDrawer() {
  const email = el('input', { type: 'email', placeholder: 'name@example.com', autocomplete: 'email', required: true });
  const error = el('p', { class: 'form-error', hidden: true });
  const submit = async () => {
    const value = email.value.trim();
    if (!value) { error.hidden = false; error.textContent = '이메일을 적어 주세요.'; return; }
    button.disabled = true;
    try {
      await store.login(value);
      drawer.close();
      toast('로그인 링크를 메일로 보냈습니다. 메일함을 확인해 주세요.');
    } catch (e) {
      error.hidden = false;
      error.textContent = e.message;
      button.disabled = false;
    }
  };
  const button = el('button', { type: 'button', class: 'btn primary', onclick: submit }, '로그인 링크 보내기');
  email.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  const drawer = openDrawer({
    title: '관리자 로그인',
    lead: el('span', { class: 'chip' }, icon('open')),
    body: el('div', {},
      el('p', { class: 'lead-muted', style: 'margin-bottom:14px' }, '비밀번호 대신 메일로 받은 링크를 눌러 들어옵니다. Supabase 에 등록된 관리자 이메일만 됩니다.'),
      field('이메일', email),
      error),
    footer: button,
  });
  setTimeout(() => email.focus(), 50);
}

function sideFoot() {
  if (store.kind !== 'supabase') {
    return el('div', { class: 'side-foot' },
      el('span', { class: 'avatar' }, (me.name || '?').slice(0, 1)),
      el('span', {}, me.name || '사용자', me.email ? el('small', { style: 'display:block;opacity:.6' }, me.email) : null));
  }
  if (me.can_edit) {
    return el('div', { class: 'side-foot' },
      el('span', { class: 'avatar' }, (me.name || '?').slice(0, 1)),
      el('span', { class: 'side-who' }, me.name, el('small', {}, me.email)),
      el('button', { type: 'button', class: 'side-act', onclick: async () => { await store.logout(); location.reload(); } }, '로그아웃'));
  }
  return el('div', { class: 'side-foot' },
    el('span', { class: 'avatar dim' }, '?'),
    el('span', { class: 'side-who' }, '방문자', el('small', {}, '보기 전용')),
    el('button', { type: 'button', class: 'side-act', onclick: loginDrawer }, '관리자 로그인'));
}

const side = el('aside', { class: 'side' },
  el('div', { class: 'brand' }, 'HR 캘린더', el('small', {}, '인사파트 업무 달력')),
  NAV.map(([view, label, ic]) => (links[view] = el('a', { class: 'nav-btn', href: hashOf(view) }, icon(ic), label))),
  sideFoot());

const pageTitle = el('h1', {}, '');
const board = el('div', { class: 'board' });
const main = el('main', { class: 'main' },
  el('div', { class: 'topbar' }, pageTitle, el('span', { class: 'mode-badge' }, MODE.badge)),
  board);

root.replaceChildren(el('div', { class: 'shell' }, side, main));

// 다른 탭에서 로그인하거나 메일 링크로 돌아오면 화면을 처음부터 다시 그린다.
if (store.kind === 'supabase') store.onAuthChange(() => location.reload());
if (location.hash.startsWith('#error')) {
  const why = new URLSearchParams(location.hash.slice(1)).get('error_description') || '로그인 링크가 만료되었거나 올바르지 않습니다.';
  history.replaceState(null, '', location.pathname + location.search + '#/calendar');
  setTimeout(() => toast(why), 300);
}

function renderHome(target) {
  target.replaceChildren(el('div', { class: 'home-grid' },
    el('div', { class: 'card' },
      el('h3', {}, '업무 캘린더'),
      el('p', {}, '급여·세무·복지 같은 반복 업무를 달력에 올려 두고, 한 일은 눌러서 완료 체크합니다.'),
      el('a', { class: 'btn primary', href: hashOf('calendar') }, icon('calendar'), '캘린더 열기')),
    el('div', { class: 'card' },
      el('h3', {}, '어떻게 쓰나요'),
      el('p', {}, '① 오른쪽 위 [편집 모드]를 켜고 [일정 추가]로 업무를 올립니다. ② 평소에는 칩을 눌러 완료 체크만 합니다. ③ 날짜 칸을 누르면 그날 목록이 열립니다.')),
    el('div', { class: 'card' },
      el('h3', {}, MODE.title),
      el('p', {}, MODE.text))));
}

function paint() {
  const view = viewOf(location.hash);
  for (const [v, a] of Object.entries(links)) a.classList.toggle('on', v === view);
  pageTitle.textContent = view === 'calendar' ? '캘린더' : '홈';
  document.title = (view === 'calendar' ? '캘린더' : '홈') + ' · HR 캘린더';
  if (view === 'calendar') renderCalendar(board, store);
  else renderHome(board);
}

window.addEventListener('hashchange', paint);
paint();
