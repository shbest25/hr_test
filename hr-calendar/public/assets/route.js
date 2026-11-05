// 해시(#/...) 주소. 경로(/calendar)로 하면 정적 호스팅이 404 를 주고, 로그인 왕복에도 해시는 그대로 남는다.
const PLAIN = new Set(['home', 'calendar']);

// 'calendar' → '#/calendar'
export function hashOf(view) {
  const v = String(view ?? 'home');
  if (v === 'home') return '#/';
  return PLAIN.has(v) ? `#/${v}` : '#/';
}

// '#/calendar' → 'calendar'. 모르는 주소는 홈으로 보낸다(404 화면을 만들지 않는다).
export function viewOf(hash) {
  const raw = String(hash ?? '').replace(/^#/, '').replace(/^\//, '');
  if (!raw) return 'home';
  const [head, ...rest] = raw.split('/').filter(Boolean);
  if (rest.length) return 'home';
  return PLAIN.has(head) ? head : 'home';
}
