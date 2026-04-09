export function formatDate(val: string, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(val).toLocaleDateString('sr-Latn-RS', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return val; }
}

export function formatTime(val: string): string {
  try {
    return new Date(`1970-01-01T${val}`).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return val; }
}

export function formatDatetime(val: string): string {
  try {
    const d = new Date(val);
    const date = d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date}, ${time}`;
  } catch { return val; }
}

export function timeAgo(val: string): string {
  const diff = Date.now() - new Date(val).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

export function formatNumber(n: number): string {
  return n.toLocaleString('sr-RS');
}

export function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
