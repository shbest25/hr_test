# HR 캘린더

인사파트 업무(급여·세무·복지…)를 달력에 올려 두고 완료 체크하는 웹앱입니다.
프레임워크·빌드 도구 없이 순수 HTML/CSS/JavaScript 로 되어 있고, Cloudflare Pages + D1 에 올리면 팀 전체가 같은 달력을 봅니다.

## 폴더 구조

```
시작.bat                ← 더블클릭하면 내 컴퓨터에서 달력이 열린다
index.html              ← GitHub Pages 용 안내판: public/ 으로 자동 이동
.nojekyll               ← GitHub Pages 가 파일을 그대로 내보내게 하는 빈 파일
public/                 ← 브라우저에 그대로 전달되는 파일(정적)
  index.html
  assets/
    config.js           Supabase 주소·anon 키 (비우면 체험 모드)
    style.css           색·글꼴 변수와 달력/서랍 모양
    app.js              시작점: 사이드바 + 해시 주소(#/calendar) 라우팅 + 로그인 버튼
    route.js            '#/calendar' ↔ 'calendar' 변환
    calview.js          달력 그리기(머리글·격자·칩·하루 서랍·범례)
    forms.js            일정 추가/고치기 폼, 분야 고치기 서랍
    ui.js               서랍·확인창·토스트 같은 공용 부품
    dom.js / icons.js   DOM 도우미, 선 아이콘
    store.js            자료 창구(공유 / 서버 / 체험 모드 자동 선택)
    supabase-store.js   공유 모드: Supabase 에 읽고 쓰기, 이메일 링크 로그인
    repeat.js           반복 규칙을 '그 달의 날짜'로 펼치는 계산(서버와 공유)
    model.js            자료 모양·검사 규칙·기본 분야(서버와 공유)
    holidays.js         공휴일 목록(연도별로 손으로 추가)
supabase/
  schema.sql            Supabase 테이블 + 권한 규칙 + 보기 일정 (SQL Editor 에 붙여 넣기)
functions/              ← Cloudflare Pages Functions (서버 코드, 배포하면 /api/* 가 된다)
  api/calendar.js       GET  /api/calendar?month=YYYY-MM
  api/items.js          POST /api/items
  api/items/[id].js     GET · PUT · DELETE /api/items/:id
  api/done.js           POST /api/done  { id, due, done }
  api/categories.js     GET · PUT /api/categories
  api/me.js             GET  /api/me (Cloudflare Access 로그인 사용자)
  _lib/db.js            D1 읽기·쓰기 도우미
schema.sql              D1 테이블 만들기
wrangler.toml           Cloudflare 설정(D1 연결)
```

## 1. 내 컴퓨터에서 먼저 열어 보기

서버 없이도 동작합니다(이때는 "로컬 저장 모드": 일정이 이 브라우저의 localStorage 에만 저장됨).

**가장 쉬운 방법:** 이 폴더의 `시작.bat` 을 더블클릭합니다.
검은 창이 하나 뜨고, 잠시 후 브라우저에 달력이 열립니다.
검은 창은 달력을 쓰는 동안 그대로 두고, 다 쓰면 닫으면 됩니다(닫으면 달력도 꺼집니다).

직접 명령으로 켜려면 이 폴더에서 터미널을 열고:

```bash
python -m http.server 8765 --directory public
```

그 다음 브라우저 주소창에 `http://localhost:8765/#/calendar` 를 **직접 입력**합니다.
터미널에 찍히는 `http://[::]:8765/` 링크는 안내용이라 눌러도 열리지 않습니다.
(`index.html` 을 더블클릭해 열면 ES 모듈 보안 제한 때문에 동작하지 않을 수 있으니 위처럼 서버로 여세요.)

## 2. 포트폴리오로 공개하기 (GitHub Pages + Supabase)

두 단계입니다. **2-A 만 하면 체험형**(방문자마다 자기 브라우저에서 눌러 보는 데모),
**2-B 까지 하면 공유형**(모두가 같은 달력을 보고, 로그인한 나만 고치는 살아 있는 달력)이 됩니다.
모두 무료 요금제로 됩니다. 외부에 공개하는 것이니 회사 실제 일정·실명은 넣지 말고 가공 데이터만 쓰세요.

### 2-A. GitHub Pages 로 사이트 공개 (체험형)

1. github.com 가입 → 오른쪽 위 **+ → New repository** → Repository name `hr-calendar`, **Public** 선택 → Create.
2. 만들어진 저장소 화면에서 **Add file → Upload files** 를 누르고, 탐색기에서 `hr-calendar` 폴더를 열어
   **안에 있는 파일·폴더 전부**(`public`, `functions`, `supabase`, `index.html`, `.nojekyll`, `README.md` …)를 끌어다 놓습니다.
   아래 **Commit changes** 를 누릅니다. (`시작.bat` 은 올려도 되고 안 올려도 됩니다.)
3. 저장소의 **Settings → Pages** → Build and deployment 의 Source 를 **Deploy from a branch**,
   Branch 를 **main**, 폴더를 **/ (root)** 로 고르고 Save.
4. 1~2분 뒤 같은 화면 위쪽에 주소가 뜹니다: `https://<내아이디>.github.io/hr-calendar/`
   이 주소로 들어가면 루트의 `index.html` 이 자동으로 `public/#/calendar` 로 넘겨 줍니다. 이 주소를 포트폴리오에 링크하면 끝입니다.
5. 나중에 파일을 고치면 저장소에서 다시 Upload files 로 덮어쓰면 1~2분 뒤 반영됩니다.

이 상태에서는 화면 오른쪽 위 배지가 **체험 모드** 로 뜨고, 방문자가 바꾼 내용은 그 사람 브라우저에만 남습니다.

### 2-B. Supabase 로 데이터 공유 (공유형)

1. supabase.com 가입 → **New project** → 이름 `hr-calendar`, Database Password 아무거나(적어 두기), Region **Northeast Asia (Seoul)** → Create.
2. 왼쪽 메뉴 **SQL Editor → New query** 에 이 폴더의 `supabase/schema.sql` 내용을 전부 붙여 넣고 **Run**.
   테이블 3개, 보기 일정, 그리고 "누구나 읽기 · 로그인한 사람만 쓰기" 규칙이 한 번에 들어갑니다.
3. 왼쪽 아래 **Project Settings → API Keys** 에서 두 값을 준비합니다.
   - 주소: `https://<Project ID>.supabase.co` (Project ID 는 Project Settings → General 에 있음)
   - **Publishable key** (`sb_publishable_…` 로 시작). 옛 화면이면 **anon public** 키(`eyJ…`)도 됩니다.
   `public/assets/config.js` 를 메모장으로 열어 `url` 과 `anonKey` 의 따옴표 안에 붙여 넣고 저장합니다.
   (**Secret key / service_role** 은 절대 넣지 마세요. Publishable 키는 공개용이라 GitHub 에 올라가도 됩니다.)
4. **Authentication → Users → Add user → Create new user** 에서 본인 이메일을 넣고, Auto Confirm User 를 켠 채 만듭니다.
   이 목록에 있는 사람만 로그인할 수 있습니다.
5. **Authentication → Sign In / Providers → Email** 에서 **Allow new users to sign up 을 끕니다.** (모르는 사람이 가입해 고치는 것을 막습니다.)
6. **Authentication → URL Configuration** 에서
   - Site URL: `https://<내아이디>.github.io/hr-calendar/public/`
   - Redirect URLs 에 추가: `https://<내아이디>.github.io/hr-calendar/public/**` 와 `http://localhost:8765/**`
   로그인 메일의 링크가 이 주소로 돌아옵니다.
7. 고친 `config.js` 를 GitHub 에 다시 올립니다(2-A 의 5번).

이제 사이트에 들어가면 배지가 **공유 모드 · 보기 전용** 으로 바뀌고, 왼쪽 아래 **[관리자 로그인]** 에 이메일을 넣으면 메일로 링크가 옵니다.
링크를 누르면 편집 모드가 열리고, 고친 내용이 모두에게 보입니다.

**알아 둘 점:** Supabase 무료 프로젝트는 **1주일 동안 접속이 없으면 잠듭니다.** 잠들면 사이트는 자동으로 체험 모드로 물러서고
배지에 "서버에 연결하지 못해…" 라고 뜹니다. Supabase 대시보드에 들어가 **Restore project** 를 누르면 몇 분 뒤 다시 공유 모드가 됩니다.
포트폴리오로 보여 주기 전에 한 번 들어가 깨워 두세요.

## 3. Cloudflare Pages 에 올리기 (회사 팀이 같이 쓰기, 선택)

준비물: GitHub 계정, Cloudflare 계정(무료), Node.js(wrangler 명령용).

1. 이 폴더를 GitHub 저장소로 올립니다.
2. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git** → 저장소 선택.
   - Build command: 비움
   - Build output directory: `public`
3. D1 데이터베이스를 만들고 테이블을 넣습니다.
   ```bash
   npx wrangler login
   npx wrangler d1 create hr-calendar
   ```
   출력된 `database_id` 를 `wrangler.toml` 에 붙여 넣은 뒤:
   ```bash
   npx wrangler d1 execute hr-calendar --remote --file=schema.sql
   ```
4. Pages 프로젝트 → **Settings → Bindings → D1 database** 에서 변수 이름 `DB`, 데이터베이스 `hr-calendar` 를 연결합니다.
   (wrangler.toml 을 저장소에 넣어 두면 이 단계가 자동으로 잡히기도 합니다.)
5. 다시 배포(Deployments → Retry)하면 `/api/me` 가 응답하기 시작하고, 화면 오른쪽 위 배지가 **서버 저장 모드**로 바뀝니다.

## 4. 회사 사람만 들어오게 (Cloudflare Access)

1. Cloudflare 대시보드 → **Zero Trust** → Settings → Authentication → Google 로그인 추가.
2. Access → Applications → **Add an application → Self-hosted**, 도메인에 `xxx.pages.dev` 입력.
3. Policy: *Emails ending in* `@회사도메인` 허용.

이후 접속하면 Google 로그인 화면이 먼저 뜨고, 통과한 사람의 이메일이 `/api/me` 로 전달되어 사이드바 아래에 표시됩니다.

## 5. 자주 고치게 될 곳

| 하고 싶은 일 | 고칠 파일 |
|---|---|
| Supabase 주소·키 넣기/바꾸기 | `public/assets/config.js` |
| 포트폴리오용 보기 일정 바꾸기 | `supabase/schema.sql` 의 `insert into items` 블록 (공유형) / `public/assets/store.js` 의 `seedItems` (체험형) |
| 내년 공휴일 추가 | `public/assets/holidays.js` |
| 기본 분야 이름·색 바꾸기 | `public/assets/model.js` 의 `DEFAULT_CATEGORIES` 와 `schema.sql` |
| 반복 주기 종류 추가 | `public/assets/model.js` (`REPEAT_LABEL`) + `public/assets/repeat.js` (`occurs`) |
| 색·글꼴·칸 높이 | `public/assets/style.css` 맨 위 `:root` 변수와 `.cal-*` 규칙 |
| 사이드바 메뉴 추가 | `public/assets/app.js` 의 `NAV`, `route.js` 의 `PLAIN` |

## 6. 체험 모드 자료 지우기

브라우저 개발자 도구 → Application → Local Storage 에서 `hr-calendar-v1` 을 지우면 보기 일정이 다시 들어갑니다.
