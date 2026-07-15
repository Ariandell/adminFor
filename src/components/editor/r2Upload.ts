// Завантаження аудіо в Cloudflare R2 через наш Worker.
// Секрети R2 тут не використовуються — Worker працює через R2-binding.
//
// URL Worker'а не секретний (публічний ендпоінт), тож задано дефолтом.
// За потреби можна перевизначити через VITE_AUDIO_WORKER_URL.
// VITE_AUDIO_UPLOAD_TOKEN — необовʼязковий; якщо на Worker увімкнено UPLOAD_TOKEN.

const DEFAULT_WORKER_URL = 'https://englishapp-audio.nagato228-pain.workers.dev';

const WORKER_URL = (import.meta.env.VITE_AUDIO_WORKER_URL as string | undefined) || DEFAULT_WORKER_URL;
const UPLOAD_TOKEN = import.meta.env.VITE_AUDIO_UPLOAD_TOKEN as string | undefined;

export async function uploadAudio(file: File): Promise<string> {
  const base = WORKER_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/upload?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      ...(UPLOAD_TOKEN ? { 'x-upload-token': UPLOAD_TOKEN } : {}),
    },
    body: file,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Не вдалося завантажити аудіо (${res.status}). ${detail}`);
  }

  const { url } = (await res.json()) as { url: string };
  return url;
}
