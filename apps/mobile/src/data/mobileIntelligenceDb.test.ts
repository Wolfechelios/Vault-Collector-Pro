import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSnapshotBundle } from '@vault/intelligence-sync';
import { MobileIntelligenceRepository } from './mobileIntelligenceDb';

describe('mobile intelligence IndexedDB', () => {
  beforeEach(async () => { await new Promise<void>(resolve => { const request = indexedDB.deleteDatabase('vault-mobile-test'); request.onsuccess = () => resolve(); request.onerror = () => resolve(); }); });

  it('imports a verified snapshot atomically and survives reopen', async () => {
    const snapshot = await createSnapshotBundle('vault-1', 7, { items: [{ id: 'i1', title: 'Yellow drill', category: 'tools' }], rules: [] });
    const repository = new MobileIntelligenceRepository('vault-mobile-test');
    await repository.importSnapshot(snapshot);
    expect(await repository.listItems()).toHaveLength(1);
    expect(await new MobileIntelligenceRepository('vault-mobile-test').getSnapshotMeta()).toMatchObject({ vaultId: 'vault-1', revision: 7 });
  });

  it('keeps the prior snapshot when validation fails', async () => {
    const repository = new MobileIntelligenceRepository('vault-mobile-test');
    const snapshot = await createSnapshotBundle('vault-1', 1, { items: [{ id: 'safe' }], rules: [] });
    await repository.importSnapshot(snapshot);
    await expect(repository.importSnapshot({ ...snapshot, revision: 2 })).rejects.toThrow('checksum');
    expect((await repository.listItems())[0].id).toBe('safe');
  });

  it('records append-only changes and exports them once', async () => {
    const repository = new MobileIntelligenceRepository('vault-mobile-test');
    await repository.importSnapshot(await createSnapshotBundle('vault-1', 3, { items: [], rules: [] }));
    await repository.appendChange({ id: 'c1', kind: 'saved-search', recordId: 's1', value: { query: 'drill' }, baseFingerprint: '', createdAt: '2026-07-14T00:00:00Z' });
    await repository.appendChange({ id: 'c1', kind: 'saved-search', recordId: 's1', value: { query: 'drill' }, baseFingerprint: '', createdAt: '2026-07-14T00:00:00Z' });
    const bundle = await repository.exportChanges();
    expect(bundle.changes.map(row => row.id)).toEqual(['c1']);
  });

  it('imports category schemas atomically with the snapshot', async () => {
    const repository = new MobileIntelligenceRepository('vault-mobile-test');
    const voltage = { category: 'tools', key: 'voltage', label: 'Voltage', kind: 'text', required: false, searchable: true, options: [], aliases: [], order: 10, enabled: true };
    await repository.importSnapshot(await createSnapshotBundle('vault-1', 3, { items: [], rules: [], categorySchemas: [voltage] }));
    expect(await repository.listCategorySchemas('tools')).toEqual([voltage]);
  });
});
