import {
  createChangeBundle,
  verifySnapshotBundle,
  type IntelligenceSnapshot,
  type MobileChange,
  type MobileChangeBundle,
  type SnapshotPayload
} from '@vault/intelligence-sync';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';

type SnapshotMeta = Pick<IntelligenceSnapshot, 'vaultId' | 'revision' | 'exportedAt' | 'checksum'>;

function requested<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

export class MobileIntelligenceRepository {
  constructor(private readonly databaseName = 'vault-mobile-intelligence') {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('snapshot')) database.createObjectStore('snapshot');
        if (!database.objectStoreNames.contains('changes')) database.createObjectStore('changes', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async importSnapshot(snapshot: IntelligenceSnapshot): Promise<void> {
    await verifySnapshotBundle(snapshot);
    const database = await this.open();
    try {
      const transaction = database.transaction(['snapshot', 'changes'], 'readwrite');
      const store = transaction.objectStore('snapshot');
      store.put({ vaultId: snapshot.vaultId, revision: snapshot.revision, exportedAt: snapshot.exportedAt, checksum: snapshot.checksum }, 'meta');
      store.put(snapshot.payload, 'payload');
      transaction.objectStore('changes').clear();
      await completed(transaction);
    } finally { database.close(); }
  }

  private async snapshotValue<T>(key: string): Promise<T | null> {
    const database = await this.open();
    try {
      const transaction = database.transaction('snapshot');
      const value = await requested(transaction.objectStore('snapshot').get(key));
      await completed(transaction);
      return (value as T | undefined) ?? null;
    } finally { database.close(); }
  }

  getSnapshotMeta(): Promise<SnapshotMeta | null> { return this.snapshotValue('meta'); }
  async getPayload(): Promise<SnapshotPayload | null> { return this.snapshotValue('payload'); }
  async listItems(): Promise<Array<Record<string, any>>> { return (await this.getPayload())?.items ?? []; }
  async listEvidence(): Promise<Array<Record<string, any>>> { return (await this.getPayload())?.evidence ?? []; }
  async listSuggestions(): Promise<Array<Record<string, any>>> { return (await this.getPayload())?.suggestions ?? []; }
  async listRules(): Promise<Array<Record<string, any>>> { return (await this.getPayload())?.rules ?? []; }
  async listSavedSearches(): Promise<Array<Record<string, any>>> { return (await this.getPayload())?.savedSearches ?? []; }
  async listCategorySchemas(category?: string): Promise<CategorySchemaRecord[]> {
    const rows = (await this.getPayload())?.categorySchemas ?? [];
    if (!category) return rows;
    const normalized = category.toLocaleLowerCase();
    return rows.filter(row => row.category === '*' || row.category.toLocaleLowerCase() === normalized)
      .sort((left, right) => left.order - right.order);
  }

  async appendChange(change: MobileChange): Promise<void> {
    const database = await this.open();
    try {
      const transaction = database.transaction('changes', 'readwrite');
      transaction.objectStore('changes').put(change);
      await completed(transaction);
    } finally { database.close(); }
  }

  async listChanges(): Promise<MobileChange[]> {
    const database = await this.open();
    try {
      const transaction = database.transaction('changes');
      const rows = await requested(transaction.objectStore('changes').getAll()) as MobileChange[];
      await completed(transaction);
      return rows.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    } finally { database.close(); }
  }

  async exportChanges(): Promise<MobileChangeBundle> {
    const meta = await this.getSnapshotMeta();
    if (!meta) throw new Error('Import a desktop intelligence snapshot before exporting changes.');
    return createChangeBundle(meta.vaultId, meta.revision, await this.listChanges());
  }
}
