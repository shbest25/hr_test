// 자료 모양과 검사 규칙. 브라우저와 서버(functions/)가 같은 파일을 쓴다 — 한 곳만 고치면 양쪽이 같이 바뀐다.

export const REPEAT_LABEL = {
  none: '한 번만',
  daily: '매일',
  workday: '평일마다',
  weekly: '매주',
  monthly: '매월',
  quarterly: '분기마다',
  yearly: '매년',
  month_end: '매월 말일',
};

export const HOLIDAY_LABEL = {
  keep: '그대로 둔다',
  before: '앞 평일로 당긴다',
  after: '뒤 평일로 미룬다',
};

export const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

export const ETC = 'etc';

// 처음 설치했을 때의 분야. 관리자가 '분야 고치기'에서 바꾼다.
export const DEFAULT_CATEGORIES = [
  { key: 'payroll', label: '급여', color: '#2E7D32' },
  { key: 'tax', label: '세무', color: '#6A1B9A' },
  { key: 'insurance', label: '인사행정', color: '#0277BD' },
  { key: 'settle', label: '용역관리', color: '#8D6E63' },
  { key: 'welfare', label: '복지', color: '#AD1457' },
  { key: 'onboard', label: '입·퇴사', color: '#4527A0' },
  { key: 'attend', label: '근태', color: '#558B2F' },
  { key: 'recruit', label: '채용', color: '#EF6C00' },
  { key: 'eval', label: '평가', color: '#C62828' },
  { key: 'training', label: '교육', color: '#00838F' },
  { key: 'etc', label: '기타', color: '#616161' },
];

// 새 분야에 돌아가며 주는 색. 허브 색(검정·초록)과 부딪히지 않는 짙은 색만.
export const PALETTE = ['#2E7D32', '#6A1B9A', '#0277BD', '#8D6E63', '#AD1457', '#4527A0',
  '#558B2F', '#EF6C00', '#C62828', '#00838F', '#37474F', '#5D4037'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const int = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
};

// 폼이나 API 로 들어온 일정을 믿지 않고 하나씩 거른다. 잘못되면 Error 를 던진다(메시지는 그대로 화면에 보인다).
export function cleanItem(raw, categoryKeys) {
  const v = raw || {};
  const item = {
    title: str(v.title, 100),
    category: categoryKeys.includes(v.category) ? v.category : ETC,
    repeat_kind: REPEAT_LABEL[v.repeat_kind] ? v.repeat_kind : 'none',
    on_weekday: int(v.on_weekday, 0, 6, 1),
    on_day: int(v.on_day, 1, 31, 1),
    on_month: int(v.on_month, 1, 12, 1),
    start_date: DATE.test(v.start_date || '') ? v.start_date : '',
    end_date: DATE.test(v.end_date || '') ? v.end_date : '',
    holiday_rule: HOLIDAY_LABEL[v.holiday_rule] ? v.holiday_rule : 'keep',
    lead: str(v.lead, 40),
    deputy: str(v.deputy, 40),
    note: str(v.note, 1000),
  };
  if (!item.title) throw new Error('이름을 적어 주세요.');
  if (item.repeat_kind === 'none' && !item.start_date) throw new Error('한 번만 하는 일정은 날짜(시작일)가 필요합니다.');
  if (item.start_date && item.end_date && item.end_date < item.start_date) throw new Error('종료일이 시작일보다 앞설 수 없습니다.');
  return item;
}

// 분야 목록 전체를 한 번에 받는다. 쓰는 중인 분야와 '기타'는 뺄 수 없다.
export function cleanCategories(raw, inUse = []) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('분야가 하나도 없습니다.');
  const seen = new Set();
  const rows = raw.map((r) => {
    const key = String(r?.key ?? '').trim();
    const label = str(r?.label, 12);
    const color = String(r?.color ?? '').trim().toUpperCase();
    if (!/^[a-z][a-z0-9_]{0,19}$/.test(key)) throw new Error('분야 열쇠가 올바르지 않습니다: ' + key);
    if (seen.has(key)) throw new Error('같은 분야가 두 번 있습니다: ' + key);
    if (!label) throw new Error('이름이 빈 분야가 있습니다.');
    if (!/^#[0-9A-F]{6}$/.test(color)) throw new Error('색이 올바르지 않습니다: ' + label);
    seen.add(key);
    return { key, label, color };
  });
  if (!seen.has(ETC)) throw new Error("'기타' 분야는 뺄 수 없습니다.");
  for (const key of inUse) {
    if (!seen.has(key)) throw new Error(`'${key}' 분야를 쓰는 일정이 있어 뺄 수 없습니다.`);
  }
  return rows;
}

// 비어 있지 않은 열쇠 하나 만들기: cat1, cat2, ...
export function nextKey(used, at = 1) {
  const key = 'cat' + at;
  return used.has(key) ? nextKey(used, at + 1) : key;
}
