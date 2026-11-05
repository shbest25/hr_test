// 자료 창구. 두 가지 저장소가 같은 함수 이름을 가진다.
//  - RemoteStore: Cloudflare Pages 에 올렸을 때. functions/api/* 가 D1 에 저장한다(모두가 같은 달력을 본다).
//  - LocalStore : 그냥 정적 파일로 열었을 때. 이 브라우저의 localStorage 에만 저장한다(혼자 써 보기용).
//  - SupabaseStore (supabase-store.js): config.js 에 Supabase 주소·키가 있을 때. 누구나 보고, 로그인한 관리자만 고친다.
// 시작할 때 Supabase 설정 → /api/me 응답 → Local 순으로 고른다.
import { expandMonth, holidaysOf, ymd, addDays } from './repeat.js';
import { HOLIDAYS, COVERED_YEARS } from './holidays.js';
import { DEFAULT_CATEGORIES, cleanItem, cleanCategories } from './model.js';
import { SUPABASE } from './config.js';

const KEY = 'hr-calendar-v1';
const uid = () => 'cal_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// 처음 열었을 때 보이는 보기 일정. 지우거나 고쳐도 된다.
function seedItems() {
  const today = new Date();
  const year = today.getFullYear();
  const keys = DEFAULT_CATEGORIES.map((c) => c.key);
  const raw = [
    { title: '정기급여 기반자료 제작', category: 'payroll', repeat_kind: 'monthly', on_day: 16, holiday_rule: 'before', lead: '김담당', deputy: '이담당' },
    { title: '정기급여 공지 및 급여명세서 발송', category: 'payroll', repeat_kind: 'monthly', on_day: 23, holiday_rule: 'before', lead: '김담당' },
    { title: '정기급여 품의 및 이체등록', category: 'payroll', repeat_kind: 'monthly', on_day: 27, holiday_rule: 'before', lead: '김담당', deputy: '이담당' },
    { title: '원천세 신고자료 공유', category: 'tax', repeat_kind: 'monthly', on_day: 5, holiday_rule: 'after', lead: '이담당' },
    { title: '4대보험 정산자료 제작', category: 'insurance', repeat_kind: 'monthly', on_day: 6, lead: '이담당' },
    { title: '복지카드 청구내역 공유', category: 'welfare', repeat_kind: 'monthly', on_day: 6, lead: '김담당' },
    { title: '복지카드 한도부여', category: 'welfare', repeat_kind: 'month_end', holiday_rule: 'before', lead: '김담당' },
    { title: '용역 세금계산서 정산', category: 'settle', repeat_kind: 'monthly', on_day: 16, lead: '박담당' },
    { title: '주간 인사 회의', category: 'etc', repeat_kind: 'weekly', on_weekday: 1, lead: '팀 전체' },
    { title: '신규 입사자 온보딩 점검', category: 'onboard', repeat_kind: 'none', start_date: ymd(addDays(today, 3)), lead: '김담당', note: '장비·계정·교육 일정 확인' },
    { title: '분기 법정의무교육 안내', category: 'training', repeat_kind: 'quarterly', on_day: 10, start_date: year + '-01-10', lead: '박담당' },
    { title: '연간 평가 일정 안내', category: 'eval', repeat_kind: 'yearly', on_month: 12, on_day: 1, lead: '김담당' },
  ];
  return raw.map((x) => ({ id: uid(), ...cleanItem(x, keys) }));
}

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.items) && Array.isArray(saved.categories)) return saved;
  } catch { /* 깨진 저장은 버린다 */ }
  return { items: seedItems(), done: [], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })) };
}

class LocalStore {
  constructor() {
    this.kind = 'local';
    this.state = loadLocal();
    this.save();
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* 사생활 보호 모드 등 */ }
  }
  keys() { return this.state.categories.map((c) => c.key); }

  async me() { return { email: '', name: '나' }; }

  async month(month) {
    const occ = expandMonth(this.state.items, month, HOLIDAYS);
    const doneSet = new Set(this.state.done);
    return {
      month,
      items: occ.map((o) => ({ ...o, done: doneSet.has(o.id + '|' + o.due), can_edit: true })),
      holidays: holidaysOf(HOLIDAYS, month),
      categories: this.state.categories,
      can_edit: true,
      can_edit_categories: true,
      covered: COVERED_YEARS.has(month.slice(0, 4)),
    };
  }
  async get(id) {
    const item = this.state.items.find((x) => x.id === id);
    if (!item) throw new Error('그 일정을 찾을 수 없습니다.');
    return { ...item };
  }
  async create(values) {
    const item = { id: uid(), ...cleanItem(values, this.keys()) };
    this.state.items.push(item);
    this.save();
    return item;
  }
  async update(id, values) {
    const at = this.state.items.findIndex((x) => x.id === id);
    if (at < 0) throw new Error('그 일정을 찾을 수 없습니다.');
    this.state.items[at] = { id, ...cleanItem(values, this.keys()) };
    this.save();
    return this.state.items[at];
  }
  async remove(id) {
    this.state.items = this.state.items.filter((x) => x.id !== id);
    this.state.done = this.state.done.filter((k) => !k.startsWith(id + '|'));
    this.save();
    return true;
  }
  async setDone(id, due, done) {
    const key = id + '|' + due;
    const has = this.state.done.includes(key);
    if (done && !has) this.state.done.push(key);
    if (!done && has) this.state.done = this.state.done.filter((k) => k !== key);
    this.save();
    return true;
  }
  async saveCategories(rows) {
    const inUse = [...new Set(this.state.items.map((x) => x.category))];
    this.state.categories = cleanCategories(rows, inUse);
    this.save();
    return this.state.categories;
  }
}

class RemoteStore {
  constructor() { this.kind = 'remote'; }
  async request(path, init = {}) {
    const res = await fetch(path, {
      ...init,
      headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) },
    });
    let body = null;
    try { body = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) throw new Error(body?.error || `요청에 실패했습니다 (${res.status})`);
    return body;
  }
  me() { return this.request('/api/me'); }
  month(month) { return this.request('/api/calendar?month=' + encodeURIComponent(month)); }
  get(id) { return this.request('/api/items/' + encodeURIComponent(id)); }
  create(values) { return this.request('/api/items', { method: 'POST', body: JSON.stringify(values) }); }
  update(id, values) { return this.request('/api/items/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(values) }); }
  remove(id) { return this.request('/api/items/' + encodeURIComponent(id), { method: 'DELETE' }); }
  async setDone(id, due, done) { await this.request('/api/done', { method: 'POST', body: JSON.stringify({ id, due, done }) }); return true; }
  saveCategories(rows) { return this.request('/api/categories', { method: 'PUT', body: JSON.stringify(rows) }); }
}

export async function detectStore() {
  // 1) Supabase 설정이 있으면 공유 모드. 연결이 안 되면(프로젝트가 잠들었거나 키가 틀리면) 체험 모드로 물러선다.
  if (SUPABASE.url && SUPABASE.anonKey) {
    try {
      const { SupabaseStore } = await import('./supabase-store.js');
      return await SupabaseStore.connect(SUPABASE);
    } catch (e) {
      console.warn('Supabase 연결 실패. 체험 모드로 엽니다.', e);
      const local = new LocalStore();
      local.fallback = e?.message || '서버에 연결하지 못했습니다';
      return local;
    }
  }
  // 2) Cloudflare Pages Functions 가 있으면 서버 모드.
  try {
    const res = await fetch('/api/me', { headers: { accept: 'application/json' } });
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) return new RemoteStore();
  } catch { /* 서버 없음 */ }
  return new LocalStore();
}
