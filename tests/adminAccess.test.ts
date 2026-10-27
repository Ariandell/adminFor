import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminAccess, type AdminAccessSnapshot } from '../src/lib/adminAccess.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test('focus and token refresh preserve a verified workspace while rechecking its role', async () => {
  const events: AdminAccessSnapshot[] = [];
  let reply = deferred<boolean>();
  let calls = 0;
  const guard = createAdminAccess(() => { calls++; return reply.promise; }, state => events.push(state));
  const initial = guard.update('owner');
  reply.resolve(true);
  await initial;
  assert.equal(events.at(-1)?.status, 'allowed');
  events.length = 0;
  reply = deferred<boolean>();
  const refresh = guard.update('owner');
  assert.equal(guard.update('owner'), refresh);
  await Promise.resolve();
  assert.equal(calls, 2);
  assert.deepEqual(events, [], 'no checking state may remove the mounted editor');
  reply.resolve(true);
  await refresh;
  assert.deepEqual(events, []);
});

test('switching accounts and signing out immediately hide the previous private workspace', async () => {
  const events: AdminAccessSnapshot[] = [];
  const reply = deferred<boolean>();
  const guard = createAdminAccess(() => reply.promise, state => events.push(state));
  const first = guard.update('first');
  const second = guard.update('second');
  assert.deepEqual(events.at(-1), { status: 'checking', accountId: 'second' });
  await guard.update(null);
  reply.resolve(true);
  await Promise.all([first, second]);
  assert.deepEqual(events.at(-1), { status: 'signed-out', accountId: null });
});

test('revoked role and failed verification still deny access after a refresh', async () => {
  for (const failure of [false, new Error('verification failed')]) {
    const events: AdminAccessSnapshot[] = [];
    let result: boolean | Error = true;
    const guard = createAdminAccess(async () => {
      if (result instanceof Error) throw result;
      return result;
    }, state => events.push(state));
    await guard.update('owner');
    result = failure;
    await guard.update('owner');
    assert.equal(events.at(-1)?.status, 'denied');
  }
});

test('late checks cannot restore an old account or publish after disposal', async () => {
  const events: AdminAccessSnapshot[] = [];
  const old = deferred<boolean>(), current = deferred<boolean>();
  let calls = 0;
  const guard = createAdminAccess(() => (++calls === 1 ? old : current).promise, state => events.push(state));
  const first = guard.update('first');
  await Promise.resolve();
  const second = guard.update('second');
  await Promise.resolve();
  current.resolve(false);
  await second;
  old.resolve(true);
  await first;
  assert.deepEqual(events.at(-1), { status: 'denied', accountId: 'second' });
  const before = events.length;
  guard.dispose();
  await guard.update('first');
  assert.equal(events.length, before);
});
