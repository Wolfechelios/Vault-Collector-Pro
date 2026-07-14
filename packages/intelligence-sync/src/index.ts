export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type SnapshotPayload = {
  items: Array<Record<string, JsonValue>>;
  evidence?: Array<Record<string, JsonValue>>;
  suggestions?: Array<Record<string, JsonValue>>;
  fieldState?: Array<Record<string, JsonValue>>;
  rules: Array<Record<string, JsonValue>>;
  savedSearches?: Array<Record<string, JsonValue>>;
};
export type IntelligenceSnapshot = {
  format: 'vault-intelligence-snapshot'; version: 1; vaultId: string; revision: number;
  exportedAt: string; payload: SnapshotPayload; checksum: string;
};
export type MobileChangeKind = 'suggestion-decision' | 'field-edit' | 'capture' | 'rule-edit' | 'rule-delete' | 'saved-search';
export type MobileChange = {
  id: string; kind: MobileChangeKind; recordId: string; value: JsonValue;
  baseFingerprint: string; createdAt: string;
};
export type MobileChangeBundle = {
  format: 'vault-mobile-changes'; version: 1; vaultId: string; baseRevision: number;
  createdAt: string; changes: MobileChange[]; checksum: string;
};
export type MergeConflict = { change: MobileChange; reason: 'protected' | 'concurrent-change' };
export type MergePlan = { applicable: MobileChange[]; duplicates: MobileChange[]; conflicts: MergeConflict[] };

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

async function checksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const withoutChecksum = <T extends { checksum: string }>(bundle: T): Omit<T, 'checksum'> => {
  const { checksum: _, ...body } = bundle;
  return body;
};

export async function createSnapshotBundle(
  vaultId: string, revision: number, payload: SnapshotPayload, exportedAt = new Date().toISOString()
): Promise<IntelligenceSnapshot> {
  const body = { format: 'vault-intelligence-snapshot' as const, version: 1 as const, vaultId, revision, exportedAt, payload };
  return { ...body, checksum: await checksum(body) };
}

export async function createChangeBundle(
  vaultId: string, baseRevision: number, changes: MobileChange[], createdAt = new Date().toISOString()
): Promise<MobileChangeBundle> {
  const body = { format: 'vault-mobile-changes' as const, version: 1 as const, vaultId, baseRevision, createdAt, changes };
  return { ...body, checksum: await checksum(body) };
}

function requireEnvelope(bundle: any, format: string, vaultId?: string) {
  if (!bundle || bundle.format !== format) throw new Error(`Invalid ${format} format.`);
  if (bundle.version !== 1) throw new Error(`Unsupported intelligence bundle version ${String(bundle.version)}.`);
  if (vaultId && bundle.vaultId !== vaultId) throw new Error('Bundle belongs to a different vault.');
}

export async function verifySnapshotBundle(bundle: IntelligenceSnapshot, vaultId?: string): Promise<IntelligenceSnapshot> {
  requireEnvelope(bundle, 'vault-intelligence-snapshot', vaultId);
  if (await checksum(withoutChecksum(bundle)) !== bundle.checksum) throw new Error('Snapshot checksum does not match.');
  if (!Array.isArray(bundle.payload?.items) || !Array.isArray(bundle.payload?.rules)) throw new Error('Snapshot payload is malformed.');
  return bundle;
}

export async function verifyChangeBundle(bundle: MobileChangeBundle, vaultId?: string): Promise<MobileChangeBundle> {
  requireEnvelope(bundle, 'vault-mobile-changes', vaultId);
  if (await checksum(withoutChecksum(bundle)) !== bundle.checksum) throw new Error('Change bundle checksum does not match.');
  if (!Array.isArray(bundle.changes)) throw new Error('Change bundle is malformed.');
  const ids = bundle.changes.map(change => change.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate mobile change identifier.');
  return bundle;
}

export function planMobileChanges(
  bundle: MobileChangeBundle,
  state: { fingerprints: Record<string, string>; protectedRecordIds: Set<string>; appliedChangeIds: Set<string> }
): MergePlan {
  const plan: MergePlan = { applicable: [], duplicates: [], conflicts: [] };
  for (const change of bundle.changes) {
    if (state.appliedChangeIds.has(change.id)) plan.duplicates.push(change);
    else if (state.protectedRecordIds.has(change.recordId)) plan.conflicts.push({ change, reason: 'protected' });
    else if (change.baseFingerprint && state.fingerprints[change.recordId] !== change.baseFingerprint) {
      plan.conflicts.push({ change, reason: 'concurrent-change' });
    } else plan.applicable.push(change);
  }
  return plan;
}

export function canonicalFingerprint(value: unknown): Promise<string> { return checksum(value); }
