import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeVideoId } from '../src/lib/youtubeVideo.ts';

test('extracts YouTube ids supported by the app', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('rejects foreign hosts and unsafe URLs', () => {
  for (const value of ['', 'javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://example.com/watch?v=dQw4w9WgXcQ']) {
    assert.equal(youtubeVideoId(value), null, value);
  }
});
