const videoIdPattern = /^[A-Za-z0-9_-]{6,20}$/;

export function youtubeVideoId(value: string): string | null {
  const trimmed = value.trim();
  if (videoIdPattern.test(trimmed)) return trimmed;
  let url: URL;
  try { url = new URL(trimmed); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
    candidate = url.searchParams.get('v');
    if (!candidate) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) candidate = parts[1] ?? null;
    }
  }
  return candidate && videoIdPattern.test(candidate) ? candidate : null;
}
