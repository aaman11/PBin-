export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed', err);
    return false;
  }
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatRemainingTime(expiresAtStr: string | null): { text: string; isExpired: boolean } {
  if (!expiresAtStr) return { text: 'Never expires', isExpired: false };
  const target = new Date(expiresAtStr).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return { text: 'Expired', isExpired: true };

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return { text: `${days}d ${hours % 24}h remaining`, isExpired: false };
  if (hours > 0) return { text: `${hours}h ${minutes % 60}m remaining`, isExpired: false };
  if (minutes > 0) return { text: `${minutes}m ${seconds % 60}s remaining`, isExpired: false };
  return { text: `${seconds}s remaining`, isExpired: false };
}

export function formatTimeAgo(dateStr: string): string {
  const past = new Date(dateStr).getTime();
  const diff = Math.max(0, Date.now() - past);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
