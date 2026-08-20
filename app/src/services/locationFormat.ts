export function formatWorldLocation(value: string): string {
  const segments = value.split('·').map(segment => segment.trim()).filter(Boolean);
  return segments.slice(0, 3).join('·') || value.trim() || '未接入';
}
