# jira-discord-webhook

Jira 이슈 이벤트와 일정(시작일·마감일)을 Discord로 알림 보내는 Vercel 서버리스 앱입니다.

## 동작 방식

```
Jira 이벤트 발생
  └─ POST /api/jira-webhook ──→ Discord (실시간 변경 알림)

매일 KST 09:00 (UTC 00:00)
  └─ Vercel Cron → GET /api/cron-check-dates ──→ Discord (D-Day 알림)
```

### 알림 종류

| 이벤트 | 색상 | 내용 |
|--------|------|------|
| 이슈 생성 | 파란색 | 제목·상태·담당자·일정 |
| 상태 변경 | 노란색 | `할 일 → 진행 중` |
| 일정 변경 | 주황색 | `2026-01-01 → 2026-01-15` |
| 내용 변경 | 회색 | 제목·설명·담당자 변경 |
| 오늘 시작일 | 초록색 | 매일 아침 D-Day 알림 |
| 오늘 마감일 | 빨간색 | 매일 아침 D-Day 알림 |

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
| `JIRA_WEBHOOK_SECRET` | 웹훅 요청 검증용 시크릿 (권장) | ❌ |

> `CRON_SECRET`은 Vercel이 자동 주입합니다. 직접 설정하지 않아도 됩니다.

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
   | 이벤트 | ✅ Issue created &nbsp; ✅ Issue updated |

4. **저장**

---

## 시작일 필드가 없을 때

Jira 무료 플랜에서 이슈에 **시작일(Start date)** 필드가 보이지 않으면:

1. Jira 프로젝트 → **프로젝트 설정** → **이슈 유형**
2. 이슈 유형 편집 → **시작일** 필드 추가

또는 **보드** 뷰에서 타임라인(로드맵)을 활성화하면 시작일 설정이 가능합니다.

크론 JQL에서 `startdate`를 쓰는데, Jira 인스턴스에 따라 커스텀 필드로 등록된 경우 JQL 필드명이 다를 수 있습니다. 그 경우 `api/cron-check-dates.js`의 `queryJira` 호출부 JQL을 수정하세요.
