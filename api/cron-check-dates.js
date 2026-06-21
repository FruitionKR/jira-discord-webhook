import { sendDiscordEmbed, COLOR } from '../lib/discord.js';

// vercel.json에서 매일 UTC 23:20 (KST 08:20) 자동 실행
export default async function handler(req, res) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron-check-dates] missing CRON_SECRET');
    return res.status(500).json({ error: 'CRON_SECRET 환경변수가 필요합니다' });
  }

  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[cron-check-dates] unauthorized request', {
      hasAuthorization: Boolean(req.headers.authorization),
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = getKstDateString();

  try {
    const [startIssues, dueIssues] = await Promise.all([
      queryJira(`"Start date[Date]" = "${today}"`),
      queryJira(`duedate = "${today}"`),
    ]);

    const startKeys = new Set(startIssues.map(i => i.key));

    await Promise.all([
      ...startIssues.map(issue => sendDiscordEmbed(dateEmbed(issue, 'start'))),
      ...dueIssues.map(issue  => sendDiscordEmbed(dateEmbed(issue, 'due', startKeys.has(issue.key)))),
    ]);

    console.log('[cron-check-dates] sent date notifications', {
      today,
      startCount: startIssues.length,
      dueCount: dueIssues.length,
    });

    return res.status(200).json({ ok: true, today, startCount: startIssues.length, dueCount: dueIssues.length });
  } catch (err) {
    console.error('[cron-check-dates] failed to send date notifications', {
      today,
      error: err.message,
    });
    return res.status(500).json({ error: err.message });
  }
}

function getKstDateString(date = new Date()) {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffsetMs).toISOString().slice(0, 10);
}

async function queryJira(jql) {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error('JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN 환경변수가 필요합니다');
  }

  const cred = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  const qs = new URLSearchParams({
    jql,
    maxResults: '50',
    fields: 'summary,status,assignee,priority,duedate,startdate',
  });

  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql?${qs}`, {
    headers: { Authorization: `Basic ${cred}`, Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`Jira API ${res.status}: ${await res.text()}`);
  return (await res.json()).issues ?? [];
}

function dateEmbed(issue, type, isAlsoStart = false) {
  const f = issue.fields ?? {};
  const url = `${process.env.JIRA_BASE_URL}/browse/${issue.key}`;
  const isStart = type === 'start';

  return {
    color: isStart ? COLOR.GREEN : COLOR.RED,
    title: `[${issue.key}] ${f.summary ?? '(제목 없음)'}`,
    url,
    description: isStart
      ? '오늘 시작하는 이슈입니다'
      : isAlsoStart
        ? '오늘 시작 & 마감인 이슈입니다'
        : '오늘 마감인 이슈입니다',
    fields: [
      { name: '상태',    value: f.status?.name ?? '-',               inline: true },
      { name: '우선순위', value: f.priority?.name ?? '-',             inline: true },
      { name: '담당자',  value: f.assignee?.displayName ?? '미배정',  inline: true },
    ],
    timestamp: new Date().toISOString(),
  };
}
