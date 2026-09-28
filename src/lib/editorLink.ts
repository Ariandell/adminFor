/** Only web and email links may be embedded in lesson content. */
export function normalizeEditorLink(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value) || value.startsWith('//')) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol === 'mailto:') return url.pathname.includes('@') ? url.href : null;
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}
