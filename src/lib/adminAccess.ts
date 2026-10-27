export type AdminAccessStatus = 'checking' | 'signed-out' | 'denied' | 'allowed';
export type AdminAccessSnapshot = { status: AdminAccessStatus; accountId: string | null };

/** Session refresh must not unmount an already verified account's workspace. */
export function createAdminAccess(
  verify: () => Promise<boolean>,
  publish: (snapshot: AdminAccessSnapshot) => void,
) {
  let account: string | null | undefined;
  let snapshot: AdminAccessSnapshot = { status: 'checking', accountId: null };
  let generation = 0;
  let disposed = false;
  let pending: Promise<void> | null = null;

  const emit = (status: AdminAccessStatus, accountId: string | null) => {
    if (snapshot.status === status && snapshot.accountId === accountId) return;
    snapshot = { status, accountId };
    publish(snapshot);
  };

  function update(accountId: string | null): Promise<void> {
    if (disposed) return Promise.resolve();
    if (account !== accountId) {
      account = accountId;
      generation++;
      pending = null;
      // Hide the previous user's private UI immediately on an account change.
      emit(accountId ? 'checking' : 'signed-out', accountId);
    }
    if (!accountId) return Promise.resolve();
    if (pending) return pending;
    if (snapshot.status !== 'allowed') emit('checking', accountId);
    const version = generation;
    const request = Promise.resolve().then(verify).then(
      allowed => {
        if (!disposed && version === generation) emit(allowed ? 'allowed' : 'denied', accountId);
      },
      () => {
        if (!disposed && version === generation) emit('denied', accountId);
      },
    ).finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
    return request;
  }

  return {
    update,
    dispose() { disposed = true; generation++; pending = null; },
  };
}
