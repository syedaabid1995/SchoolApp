import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireDistributedLock,
  runWithDistributedLock,
  type DistributedLockClient,
} from '../services/distributedLock.service';

class FakeRedisLockClient implements DistributedLockClient {
  private readonly values = new Map<string, string>();

  async set(key: string, value: string, _pxMode: 'PX', _ttlMs: number, nxMode: 'NX') {
    assert.equal(nxMode, 'NX');
    if (this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK' as const;
  }

  async eval(_script: string, _keyCount: number, key: string, token: string) {
    if (this.values.get(key) !== token) return 0;
    this.values.delete(key);
    return 1;
  }
}

test('distributed lock acquire rejects a second owner until released', async () => {
  const client = new FakeRedisLockClient();
  const first = await acquireDistributedLock({ key: 'lock:test', ttlMs: 1000, client, ownerToken: 'owner-1' });
  assert.ok(first);

  const second = await acquireDistributedLock({ key: 'lock:test', ttlMs: 1000, client, ownerToken: 'owner-2' });
  assert.equal(second, null);

  assert.equal(await first.release(), true);

  const third = await acquireDistributedLock({ key: 'lock:test', ttlMs: 1000, client, ownerToken: 'owner-3' });
  assert.ok(third);
  assert.equal(await third.release(), true);
});

test('distributed lock release only succeeds for the owner token', async () => {
  const client = new FakeRedisLockClient();
  const lock = await acquireDistributedLock({ key: 'lock:test', ttlMs: 1000, client, ownerToken: 'owner-1' });
  assert.ok(lock);

  const intruderRelease = await client.eval('', 1, 'lock:test', 'owner-2');
  assert.equal(intruderRelease, 0);

  const blocked = await acquireDistributedLock({ key: 'lock:test', ttlMs: 1000, client, ownerToken: 'owner-2' });
  assert.equal(blocked, null);
  assert.equal(await lock.release(), true);
});

test('scheduled job helper skips execution when lock is held', async () => {
  const client = new FakeRedisLockClient();
  const lock = await acquireDistributedLock({ key: 'lock:job', ttlMs: 1000, client, ownerToken: 'owner-1' });
  assert.ok(lock);

  let executed = false;
  let skipped = false;
  const result = await runWithDistributedLock({
    key: 'lock:job',
    ttlMs: 1000,
    jobName: 'test-job',
    client,
    onSkipped: () => {
      skipped = true;
    },
    run: async () => {
      executed = true;
    },
  });

  assert.equal(result.status, 'skipped');
  assert.equal(skipped, true);
  assert.equal(executed, false);
  assert.equal(await lock.release(), true);
});
