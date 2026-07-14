import React from 'react';
import type { EvidenceRecord } from '../../lib/catalogueApi';

export function EvidenceViewer({ evidence }: { evidence: EvidenceRecord[] }) {
  if (!evidence.length) return <p className="empty-state">No source evidence is available.</p>;
  return <div className="evidence-viewer">
    {evidence.map((row) => <article key={row.id} className="evidence-card">
      <div className="evidence-source">
        <span>{row.sourceKind}</span>
        <b>{Math.round(row.confidence * 100)}%</b>
      </div>
      <strong>{row.fieldName}: {row.value}</strong>
      {row.sourceMediaId && <small>Source photo: {row.sourceMediaId}</small>}
      {row.rawText && <pre>{row.rawText}</pre>}
      {row.provider && <small>Provider: {row.provider}</small>}
    </article>)}
  </div>;
}
