const YEAR_DAYS = 360;
const MONTH_DAYS = 30;

function chineseNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if ([...value].every(char => char in digits) && value.length > 1) return Number([...value].map(char => digits[char]).join(''));
  if (value === '十') return 10;
  const match = value.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
  if (match) return (match[1] ? digits[match[1]] : 1) * 10 + (match[2] ? digits[match[2]] : 0);
  return value.length === 1 && value in digits ? digits[value] : null;
}

const MONTHS: Record<string, number> = { 正: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 冬: 11, 十一: 11, 腊: 12, 十二: 12 };

export function parseFantasyCalendarDay(label: string): number | null {
  const normalized = label.replace(/[·\s]/g, '');
  const yearMatch = normalized.match(/^(?:元会历)?([〇零一二两三四五六七八九十\d]+)年/);
  if (!yearMatch) return null;
  const year = chineseNumber(yearMatch[1]);
  if (year === null) return null;
  const monthMatch = normalized.match(/年([正一二三四五六七八九十冬腊\d]+)月/);
  const month = monthMatch ? (MONTHS[monthMatch[1]] ?? chineseNumber(monthMatch[1]) ?? 1) : 1;
  const dayMatch = normalized.match(/(?:月|初)([一二两三四五六七八九十廿卅\d]+)(?:日|号)?/);
  let day = 1;
  if (dayMatch) {
    const text = dayMatch[1].replace(/^廿/, '二十').replace(/^卅/, '三十');
    day = chineseNumber(text) ?? 1;
  }
  return year * YEAR_DAYS + (Math.max(1, Math.min(12, month)) - 1) * MONTH_DAYS + Math.max(1, Math.min(30, day)) - 1;
}

export function inferElapsedWorldDays(previousLabel: string, currentLabel: string): number | null {
  const previous = parseFantasyCalendarDay(previousLabel);
  const current = parseFantasyCalendarDay(currentLabel);
  if (previous === null || current === null) return null;
  return Math.max(0, current - previous);
}
