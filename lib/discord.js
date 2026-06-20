export async function sendDiscordEmbed(embed) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error('DISCORD_WEBHOOK_URL 환경변수가 없습니다');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord 전송 실패 ${res.status}: ${text}`);
  }
}

export const COLOR = {
  BLUE:   0x0052cc, // 이슈 생성
  YELLOW: 0xffab00, // 상태 변경
  ORANGE: 0xff5630, // 일정 변경
  GRAY:   0x6b778c, // 내용 변경
  GREEN:  0x36b37e, // 시작일 D-Day
  RED:    0xde350b, // 마감일 D-Day
};
