export function formatTime12h(hour24: number): string {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  let h = hour24 % 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, '0')}:00 ${period}`;
}

export function parseHourFromTime(timeStr: string): number {
  const s = String(timeStr).replace(/\u00A0/g, ' ').trim();
  const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return NaN;

  let hour = Number(m[1]);
  const period = m[3]?.toUpperCase();

  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }
  return hour;
}

export function parseDurationFromEndTime(endTimeStr: string): number {
  if (!endTimeStr) return NaN;
  const s = String(endTimeStr).replace(/\u00A0/g, ' ').trim();
  const m = s.match(/\((\d+)\s*hrs?\)/i);
  return m ? Number(m[1]) : NaN;
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function normalizeServerTime(iso: string, mode: 'utc' | 'local-wall'): Date {
    if (mode === 'utc') {
        return new Date(iso);
    }
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) {
        return new Date(iso);
    }
    const [, y, mo, d, h, min, s = '0'] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(min), Number(s), 0);
}