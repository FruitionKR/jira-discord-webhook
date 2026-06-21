# jira-discord-webhook

Jira 이슈 이벤트와 일정(시작일·마감일)을 Discord로 알림 보내는 Vercel 서버리스 앱입니다.

## 동작 방식

```
Jira 이벤트 발생
  └─ POST /api/jira-webhook ──→ Discord (실시간 변경 알림)

매일 KST 08:00 (UTC 23:00)
  └─ Vercel Cron → GET /api/cron-check-dates ──→ Discord (D-Day 알림)
```

### 실시간 웹훅 플로우

1. Jira에서 이슈 생성, 수정, 삭제 이벤트가 발생합니다.
2. Jira 전역 웹훅 설정이 이벤트 종류와 JQL 조건을 검사합니다.
3. 조건에 맞으면 Jira가 `POST /api/jira-webhook`으로 payload를 보냅니다.
4. Vercel이 `api/jira-webhook.js` 서버리스 함수를 실행합니다.
5. 함수가 이벤트 타입을 보고 Discord embed를 만들어 `DISCORD_WEBHOOK_URL`로 전송합니다.

`curl`로 `POST /api/jira-webhook` 테스트가 성공하고 Discord 알림이 온다면 Vercel, 코드, Discord 설정은 정상입니다. 이 상태에서 Jira에서 만든 이슈만 알림이 안 오면 Jira 웹훅 URL, 이벤트 선택, JQL 조건, 관리자 권한 설정을 확인해야 합니다.

### D-Day 알림 플로우

1. Vercel Cron이 매일 UTC 23:00에 `GET /api/cron-check-dates`를 호출합니다.
2. 이 시간은 한국시간 KST 08:00입니다.
3. 함수는 KST 기준 오늘 날짜를 계산합니다.
4. Jira API에서 오늘 시작일인 이슈와 오늘 마감일인 이슈를 조회합니다.
5. 조회된 이슈를 Discord로 전송합니다.

### 알림 종류

| 이벤트 | 색상 | 내용 |
|--------|------|------|
| 이슈 생성 | 파란색 | 제목·상태·담당자·일정 |
| 상태 변경 | 노란색 | `할 일 → 진행 중` |
| 일정 변경 | 주황색 | `2026-01-01 → 2026-01-15` |
| 내용 변경 | 회색 | 제목·설명·담당자 변경 |
| 이슈 삭제 | 빨간색 | 삭제된 이슈 |
| 오늘 시작일 | 초록색 | 매일 KST 08:00 D-Day 알림 |
| 오늘 마감일 | 빨간색 | 매일 KST 08:00 D-Day 알림 |

## 파일 구조

```
api/
  jira-webhook.js      # Jira 웹훅 수신 → Discord 전송
  cron-check-dates.js  # 매일 시작일·마감일 체크 → Discord 전송
lib/
  discord.js           # Discord 웹훅 공통 유틸
.env.example           # 환경변수 템플릿
vercel.json            # Vercel 크론 스케줄 설정
```

## 환경변수

`.env.example`을 참고해 Vercel 대시보드에 아래 변수를 등록합니다.

| 변수 | 설명 | 필수 |
|------|------|------|
| `DISCORD_WEBHOOK_URL` | Discord 채널 웹훅 URL | ✅ |
| `JIRA_BASE_URL` | `https://your-domain.atlassian.net` | ✅ |
| `JIRA_EMAIL` | Jira 로그인 이메일 | ✅ |
| `JIRA_API_TOKEN` | Atlassian API 토큰 | ✅ |
| `CRON_SECRET` | Vercel Cron 호출 검증용 랜덤 문자열 | ✅ |
| `JIRA_WEBHOOK_SECRET` | 웹훅 요청 검증용 시크릿 (권장) | ❌ |

> `CRON_SECRET`은 직접 설정해야 합니다. Vercel은 프로젝트에 `CRON_SECRET` 환경변수가 있을 때만 Cron 요청에 `Authorization: Bearer <CRON_SECRET>` 헤더를 자동으로 붙입니다.

## 배포 방법

### 1. GitHub에 push

```bash
git add .
git commit -m "feat: jira-discord webhook"
git push
```

### 2. Vercel에 프로젝트 연결

1. [vercel.com](https://vercel.com) → **Add New Project**
2. GitHub 저장소 선택
3. **Environment Variables** 탭에서 위 환경변수 모두 입력
4. **Deploy** 클릭

배포 완료 후 발급되는 URL을 기억해 두세요.  
예) `https://jira-discord-webhook.vercel.app`

### 3. Jira 웹훅 등록

1. Jira → **설정(톱니바퀴)** → **시스템** → **웹훅**
2. **웹훅 만들기** 클릭
3. 아래 내용 입력:

   | 항목 | 값 |
   |------|-----|
   | URL | `https://YOUR_APP.vercel.app/api/jira-webhook` |
   | 이벤트 | ✅ Issue created &nbsp; ✅ Issue updated &nbsp; ✅ Issue deleted |

4. **저장**

`JIRA_WEBHOOK_SECRET`을 Vercel 환경변수에 설정했다면 Jira 웹훅 URL에도 같은 값을 붙여야 합니다.

```text
https://YOUR_APP.vercel.app/api/jira-webhook?secret=YOUR_SECRET
```

## 웹훅이 안 올 때 확인 순서

1. 브라우저에서 `https://YOUR_APP.vercel.app/api/jira-webhook`을 열어 `ok: true`가 나오는지 확인합니다.
2. 응답의 `hasDiscordWebhook`, `hasJiraBaseUrl`이 둘 다 `true`인지 확인합니다.
3. `requiresSecret: true`라면 Jira 웹훅 URL에 `?secret=...`이 붙어 있는지 확인합니다.
4. Vercel → Project → Logs에서 `[jira-webhook]` 로그를 확인합니다.
   - 로그가 전혀 없으면 Jira의 웹훅 URL 또는 이벤트 선택 문제입니다.
   - `unauthorized request`가 보이면 secret 설정 문제입니다.
   - `failed to process request`가 보이면 Discord 또는 환경변수 문제입니다.

## D-Day 알림이 안 올 때 확인 순서

1. Vercel → Project → Settings → Environment Variables에 `CRON_SECRET`, `JIRA_EMAIL`, `JIRA_API_TOKEN`이 있는지 확인합니다.
2. Vercel → Project → Cron Jobs → `/api/cron-check-dates` → View Logs를 확인합니다.
   - `missing CRON_SECRET` 또는 `401 Unauthorized`가 보이면 `CRON_SECRET` 설정 문제입니다.
   - `Jira API 400`이 보이면 시작일 JQL 필드명이 현재 Jira와 맞지 않는 문제일 가능성이 큽니다.
   - `ok: true`인데 `startCount: 0`이면 Jira에서 시작일 필드명 또는 실제 시작일 값이 조회 조건과 맞지 않는 상태입니다.
3. Jira에서 아래 JQL이 결과를 반환하는지 직접 검색합니다.

```text
"Start date[Date]" = "YYYY-MM-DD"
```

결과가 없으면 Jira의 시작일 필드명이 다를 수 있습니다. `Start date`, `startdate`, 또는 `cf[숫자]` 형식의 실제 필드명으로 `api/cron-check-dates.js`의 JQL을 맞춰야 합니다.

---

## 시작일 필드가 없을 때

Jira 무료 플랜에서 이슈에 **시작일(Start date)** 필드가 보이지 않으면:

1. Jira 프로젝트 → **프로젝트 설정** → **이슈 유형**
2. 이슈 유형 편집 → **시작일** 필드 추가

또는 **보드** 뷰에서 타임라인(로드맵)을 활성화하면 시작일 설정이 가능합니다.

크론 JQL에서 `startdate`를 쓰는데, Jira 인스턴스에 따라 커스텀 필드로 등록된 경우 JQL 필드명이 다를 수 있습니다. 그 경우 `api/cron-check-dates.js`의 `queryJira` 호출부 JQL을 수정하세요.
