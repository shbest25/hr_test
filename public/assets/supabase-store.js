// 공유 모드 저장소. Supabase(Postgres) 에 직접 읽고 쓴다.
//  - 읽기: 누구나(anon 키)
//  - 쓰기: 로그인한 사용자만(supabase/schema.sql 의 RLS 규칙이 막는다)
// 반복 일정을 '그 달의 날짜'로 펼치는 계산은 LocalStore 와 똑같이 브라우저에서 한다(repeat.js).
import { expandMonth, holidaysOf } from './repeat.js';
import { HOLIDAYS, COVERED_YEARS } from './holidays.js';
import { DEFAULT_CATEGORIES, cleanItem, cleanCategories } from './model.js';

// 새 'sb_publishable_…' 키 형식을 아는 버전이어야 한다(2.5x 이전 버전은 모른다).
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/+esm';
const uid = () => 'cal_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Supabase 오류를 사람이 읽을 한국어로 바꾼다.
function explain(error) {
  const msg = String(error?.message || error || '');
  if (/row-level security|42501|permission denied|JWT/i.test(msg)) return new Error('로그인한 관리자만 바꿀 수 있습니다.');
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return new Error(msg || '요청에 실패했습니다.');
}

// DB 행 ↔ 화면 자료. DB 는 빈 날짜를 null 로, 화면은 '' 로 쓴다.
const fromRow = (r) => ({ ...r, start_date: r.start_date || '', end_date: r.end_date || '', lead: r.lead || '', deputy: r.deputy || '', note: r.note || '' });
const toRow = (item) => ({ ...item, start_date: item.start_date || null, end_date: item.end_date || null, lead: item.lead || null, deputy: item.deputy || null, note: item.note || null });

export class SupabaseStore {
  constructor(client) {
    this.kind = 'supabase';
    this.sb = client;
    this.session = null;
  }

  // 연결을 만들고 로그인 상태를 읽는다. 실패하면 던진다(app.js 가 체험 모드로 물러선다).
  static async connect({ url, anonKey }) {
    const { createClient } = await import(SUPABASE_JS);
    const client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const store = new SupabaseStore(client);
    const { data, error } = await client.auth.getSession();
    if (error) throw explain(error);
    store.session = data.session;
    // 로그인 링크로 돌아왔을 때 주소에 남는 토큰 조각을 지우고 달력으로 보낸다.
    if (/^#(access_token|error|error_description)=/.test(location.hash) || location.hash.includes('&access_token=')) {
      history.replaceState(null, '', location.pathname + location.search + '#/calendar');
    }
    // 서버가 깨어 있는지 가볍게 확인(무료 프로젝트는 오래 안 쓰면 잠든다).
    const ping = await client.from('categories').select('key', { head: true, count: 'exact' });
    if (ping.error) throw explain(ping.error);
    return store;
  }

  get canEdit() { return !!this.session; }
  get email() { return this.session?.user?.email || ''; }

  // 로그인 상태가 바뀌면 부른다(다른 탭에서 로그인·로그아웃해도 반응한다).
  onAuthChange(fn) {
    this.sb.auth.onAuthStateChange((_event, session) => {
      const was = !!this.session;
      this.session = session;
      if (was !== !!session) fn(session);
    });
  }

  // 이메일로 로그인 링크를 보낸다. Authentication → Users 에 등록된 사람만 받는다.
  async login(email) {
    const redirectTo = location.origin + location.pathname;
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    if (error) {
      if (/Signups not allowed|not found|otp_disabled/i.test(error.message)) throw new Error('등록되지 않은 이메일입니다. Supabase → Authentication → Users 에 먼저 추가해 주세요.');
      throw explain(error);
    }
    return true;
  }
  async logout() {
    await this.sb.auth.signOut();
    this.session = null;
  }

  async me() {
    const email = this.email;
    return { email, name: email ? email.split('@')[0] : '방문자', can_edit: this.canEdit };
  }

  async categories() {
    const { data, error } = await this.sb.from('categories').select('key,label,color').order('pos');
    if (error) throw explain(error);
    return data?.length ? data : DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }
  async keys() { return (await this.categories()).map((c) => c.key); }

  async month(month) {
    const [items, doneRows, categories] = await Promise.all([
      this.sb.from('items').select('*').then(({ data, error }) => { if (error) throw explain(error); return (data || []).map(fromRow); }),
      this.sb.from('done').select('item_id,due').like('due', month + '-%').then(({ data, error }) => { if (error) throw explain(error); return data || []; }),
      this.categories(),
    ]);
    const doneSet = new Set(doneRows.map((d) => d.item_id + '|' + d.due));
    const occ = expandMonth(items, month, HOLIDAYS);
    return {
      month,
      items: occ.map((o) => ({ ...o, done: doneSet.has(o.id + '|' + o.due), can_edit: this.canEdit })),
      holidays: holidaysOf(HOLIDAYS, month),
      categories,
      can_edit: this.canEdit,
      can_edit_categories: this.canEdit,
      covered: COVERED_YEARS.has(month.slice(0, 4)),
    };
  }

  async get(id) {
    const { data, error } = await this.sb.from('items').select('*').eq('id', id).maybeSingle();
    if (error) throw explain(error);
    if (!data) throw new Error('그 일정을 찾을 수 없습니다.');
    return fromRow(data);
  }
  async create(values) {
    const row = { id: uid(), ...toRow(cleanItem(values, await this.keys())) };
    const { data, error } = await this.sb.from('items').insert(row).select().single();
    if (error) throw explain(error);
    return fromRow(data);
  }
  async update(id, values) {
    const row = toRow(cleanItem(values, await this.keys()));
    const { data, error } = await this.sb.from('items').update(row).eq('id', id).select().maybeSingle();
    if (error) throw explain(error);
    if (!data) throw new Error('로그인한 관리자만 바꿀 수 있습니다.');
    return fromRow(data);
  }
  async remove(id) {
    const { error, count } = await this.sb.from('items').delete({ count: 'exact' }).eq('id', id);
    if (error) throw explain(error);
    if (!count) throw new Error('로그인한 관리자만 지울 수 있습니다.');
    return true;
  }
  async setDone(id, due, done) {
    if (!this.canEdit) throw new Error('로그인한 관리자만 완료 체크를 할 수 있습니다.');
    const q = done
      ? this.sb.from('done').upsert({ item_id: id, due }, { onConflict: 'item_id,due', ignoreDuplicates: true })
      : this.sb.from('done').delete().eq('item_id', id).eq('due', due);
    const { error } = await q;
    if (error) throw explain(error);
    return true;
  }
  async saveCategories(rows) {
    const { data: items, error: e1 } = await this.sb.from('items').select('category');
    if (e1) throw explain(e1);
    const inUse = [...new Set((items || []).map((x) => x.category))];
    const clean = cleanCategories(rows, inUse);
    const { data, error } = await this.sb.rpc('replace_categories', { cats: clean });
    if (error) throw explain(error);
    return data;
  }
}
