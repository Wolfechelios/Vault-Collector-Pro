import React from 'react';
import type { ItemRecord } from '@vault/domain';

type TimelineEvent = {
  id: string;
  label: string;
  detail: string;
  at: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(date);
}

function buildTimeline(item: ItemRecord): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { id: 'created', label: 'Entered the archive', detail: 'Exhibit record created.', at: item.createdAt },
    { id: 'updated', label: 'Curator record updated', detail: 'Exhibit metadata was last changed.', at: item.updatedAt }
  ];

  if (item.acquiredAt) events.push({ id: 'acquired', label: 'Acquired', detail: 'Acquisition date recorded.', at: item.acquiredAt });
  if (item.storageLocationId || item.specifics.storagePath) events.push({ id: 'stored', label: 'Placed in archive storage', detail: item.specifics.storagePath || 'Physical archive location assigned.', at: item.updatedAt });
  if (item.medianValue) events.push({ id: 'valued', label: 'Valuation recorded', detail: `Median value ${(item.medianValue.amountMinor / 100).toLocaleString('en-US', { style: 'currency', currency: item.medianValue.currency })}.`, at: item.updatedAt });
  if (item.status === 'listed') events.push({ id: 'listed', label: 'Prepared for marketplace', detail: 'Exhibit is marked as listed.', at: item.updatedAt });
  if (item.soldAt) events.push({ id: 'sold', label: 'Sold', detail: item.soldPrice ? `Sale recorded for ${(item.soldPrice.amountMinor / 100).toLocaleString('en-US', { style: 'currency', currency: item.soldPrice.currency })}.` : 'Sale recorded.', at: item.soldAt });
  if (item.status === 'archived') events.push({ id: 'archived', label: 'Moved to historical archive', detail: 'Exhibit is no longer active in the current collection.', at: item.updatedAt });

  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function CuratorTimeline({ item }: { item: ItemRecord }) {
  const events = buildTimeline(item);
  return <section className="curator-timeline">
    <div className="timeline-head">
      <div>
        <p className="eyebrow">COLLECTION KNOWLEDGE</p>
        <h3>Curator Timeline</h3>
      </div>
      <span>{events.length} recorded moments</span>
    </div>
    <div className="timeline-list">
      {events.map(event => <article key={event.id} className="timeline-event">
        <div className="timeline-dot" />
        <div>
          <strong>{event.label}</strong>
          <p>{event.detail}</p>
          <time>{formatDate(event.at)}</time>
        </div>
      </article>)}
    </div>
  </section>;
}
