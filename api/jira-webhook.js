import { sendDiscordEmbed, COLOR } from '../lib/discord.js';

const WATCHED = new Set([
  'summary', 'description', 'status', 'priority', 'assignee',
  'duedate', 'startdate', 'Start date',
]);

const LABEL = {
  summary: '제목',
  description: '설명',
  priority: '우선순위',
  assignee: '담당자',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.JIRA_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers['x-jira-webhook-secret'] ?? req.headers['authorization'];
    if (auth !== secret && auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { webhookEvent, issue, changelog, user } = req.body ?? {};
  if (!issue) return res.status(200).json({ ok: true });

  const fields = issue.fields ?? {};
  const issueUrl = `${process.env.JIRA_BASE_URL}/browse/${issue.key}`;

  try {
    if (webhookEvent === 'jira:issue_created') {
      await sendDiscordEmbed(embedCreated(issue.key, fields, issueUrl));
    } else if (webhookEvent === 'jira:issue_updated') {
      for (const embed of embedsUpdated(issue.key, fields, issueUrl, changelog, user)) {
        await sendDiscordEmbed(embed);
      }
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ ok: true });
}

function embedCreated(key, fields, url) {
  return {
    color: COLOR.BLUE,
    title: `[${key}] ${fields.summary ?? '(제목 없음)'}`,
    url,
    description: '새 이슈가 생성되었습니다',
    fields: [
      { name: '상태',    value: fields.status?.name ?? '-',                inline: true },
      { name: '우선순위', value: fields.priority?.name ?? '-',              inline: true },
      { name: '담당자',  value: fields.assignee?.displayName ?? '미배정',   inline: true },
      fields.duedate     && { name: '마감일', value: fields.duedate,    inline: true },
      fields.startdate   && { name: '시작일', value: fields.startdate,  inline: true },
    ].filter(Boolean),
    footer: { text: `생성자: ${fields.reporter?.displayName ?? '-'}` },
    timestamp: new Date().toISOString(),
  };
}

function embedsUpdated(key, fields, url, changelog, user) {
  const items = (changelog?.items ?? []).filter(i => WATCHED.has(i.field) || WATCHED.has(i.fieldId));
  if (!items.length) return [];

  const statusItems = items.filter(i => i.field === 'status');
  const dateItems   = items.filter(i => ['duedate', 'startdate', 'Start date'].includes(i.field));
  const otherItems  = items.filter(i => !statusItems.includes(i) && !dateItems.includes(i));

  const actor = user?.displayName ?? '-';
  const title = `[${key}] ${fields.summary ?? '(제목 없음)'}`;
  const embeds = [];

  if (statusItems.length) {
    const c = statusItems[0];
    embeds.push({
      color: COLOR.YELLOW,
      title, url,
      description: `상태 변경: **${c.fromString}** → **${c.toString}**`,
      footer: { text: `변경자: ${actor}` },
      timestamp: new Date().toISOString(),
    });
  }

  if (dateItems.length) {
    embeds.push({
      color: COLOR.ORANGE,
      title, url,
      description: '일정이 변경되었습니다',
      fields: dateItems.map(c => ({
        name: c.field === 'duedate' ? '마감일' : '시작일',
        value: `~~${c.fromString ?? '없음'}~~ → **${c.toString ?? '없음'}**`,
        inline: false,
      })),
      footer: { text: `변경자: ${actor}` },
      timestamp: new Date().toISOString(),
    });
  }

  if (otherItems.length) {
    embeds.push({
      color: COLOR.GRAY,
      title, url,
      description: '이슈 내용이 변경되었습니다',
      fields: otherItems.map(c => ({
        name: LABEL[c.field] ?? c.field,
        value: `${c.fromString ?? '없음'} → **${c.toString ?? '없음'}**`,
        inline: true,
      })),
      footer: { text: `변경자: ${actor}` },
      timestamp: new Date().toISOString(),
    });
  }

  return embeds;
}
