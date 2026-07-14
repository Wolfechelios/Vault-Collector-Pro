import { describe, expect, it } from 'vitest';
import { createChangeBundle, createSnapshotBundle, planMobileChanges, verifyChangeBundle, verifySnapshotBundle } from './index';

describe('verified intelligence bundles', () => {
  it('round-trips validated category schemas', async () => {
    const categorySchemas = [{
      category: 'tools', key: 'voltage', label: 'Voltage', kind: 'text', required: false,
      searchable: true, options: [], aliases: ['volts'], order: 10, enabled: true
    }];
    const bundle = await createSnapshotBundle('vault-1', 4, { items: [], rules: [], categorySchemas });
    expect((await verifySnapshotBundle(bundle)).payload.categorySchemas).toEqual(categorySchemas);
  });

  it('rejects malformed category schemas before import', async () => {
    const bundle = await createSnapshotBundle('vault-1', 4, {
      items: [], rules: [], categorySchemas: [{ category: '', key: 'voltage', label: 'Voltage', kind: 'text' }] as never
    });
    await expect(verifySnapshotBundle(bundle)).rejects.toThrow('category schema');
  });

  it('rejects duplicate category schema keys', async () => {
    const schema = { category: 'tools', key: 'voltage', label: 'Voltage', kind: 'text', required: false, searchable: true, options: [], aliases: [], order: 10, enabled: true };
    const bundle = await createSnapshotBundle('vault-1', 4, { items: [], rules: [], categorySchemas: [schema, schema] });
    await expect(verifySnapshotBundle(bundle)).rejects.toThrow('Duplicate category schema');
  });

  it('creates deterministic checksums independent of object key order', async () => {
    const left = await createSnapshotBundle('vault-1', 4, { items: [{ id: '1', title: 'Drill' }], rules: [] }, '2026-07-14T00:00:00Z');
    const right = await createSnapshotBundle('vault-1', 4, { rules: [], items: [{ title: 'Drill', id: '1' }] }, '2026-07-14T00:00:00Z');
    expect(left.checksum).toBe(right.checksum);
    expect(await verifySnapshotBundle(left, 'vault-1')).toEqual(left);
  });

  it('rejects changed, incompatible, and wrong-vault snapshots', async () => {
    const bundle = await createSnapshotBundle('vault-1', 1, { items: [], rules: [] });
    await expect(verifySnapshotBundle({ ...bundle, revision: 2 }, 'vault-1')).rejects.toThrow('checksum');
    await expect(verifySnapshotBundle({ ...bundle, version: 2 } as never, 'vault-1')).rejects.toThrow('version');
    await expect(verifySnapshotBundle(bundle, 'vault-2')).rejects.toThrow('vault');
  });

  it('rejects duplicate mobile change identifiers', async () => {
    const change = { id: 'change-1', kind: 'suggestion-decision' as const, recordId: 's1', value: 'accept', baseFingerprint: 'same', createdAt: '2026-07-14T00:00:00Z' };
    const bundle = await createChangeBundle('vault-1', 1, [change, change]);
    await expect(verifyChangeBundle(bundle, 'vault-1')).rejects.toThrow('Duplicate');
  });
});

describe('protected mobile merge planning', () => {
  it('separates applicable, replayed, protected, and concurrent changes', async () => {
    const bundle = await createChangeBundle('vault-1', 1, [
      { id: 'apply', kind: 'field-edit', recordId: 'item:brand', value: 'DeWalt', baseFingerprint: 'a', createdAt: '2026-07-14T00:00:00Z' },
      { id: 'protected', kind: 'field-edit', recordId: 'item:model', value: 'DCD996', baseFingerprint: 'b', createdAt: '2026-07-14T00:00:01Z' },
      { id: 'stale', kind: 'rule-edit', recordId: 'rule-1', value: '{}', baseFingerprint: 'old', createdAt: '2026-07-14T00:00:02Z' },
      { id: 'seen', kind: 'saved-search', recordId: 'search-1', value: '{}', baseFingerprint: '', createdAt: '2026-07-14T00:00:03Z' }
    ]);
    const plan = planMobileChanges(bundle, {
      fingerprints: { 'item:brand': 'a', 'item:model': 'b', 'rule-1': 'new' },
      protectedRecordIds: new Set(['item:model']), appliedChangeIds: new Set(['seen'])
    });
    expect(plan.applicable.map(row => row.id)).toEqual(['apply']);
    expect(plan.duplicates.map(row => row.id)).toEqual(['seen']);
    expect(plan.conflicts.map(row => [row.change.id, row.reason])).toEqual([
      ['protected', 'protected'], ['stale', 'concurrent-change']
    ]);
  });
});
