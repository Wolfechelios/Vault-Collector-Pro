import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobileApp } from './App';
import { searchLocalItems, smartCollections } from './features/search/MobileSearch';

describe('mobile intelligence shell', () => {
  it('exposes all five touch-first intelligence workspaces', () => {
    const html = renderToStaticMarkup(<MobileApp initialTab="search"/>);
    for (const label of ['Capture', 'Review', 'Search', 'Collections', 'Rules']) expect(html).toContain(label);
    expect(html).toContain('Import desktop snapshot');
  });

  it('searches and builds smart collections offline', () => {
    const items = [
      { id: '1', title: 'Yellow DeWalt drill', category: 'tools', status: 'private', year: 2021, specifics: { storagePath: '' }, medianValue: null },
      { id: '2', title: '1900 Morgan dollar', category: 'coins', status: 'private', year: 1900, specifics: { storagePath: 'Safe' }, medianValue: { amountMinor: 60000 } }
    ];
    expect(searchLocalItems(items, 'yellow DeWalt drill').map(row => row.id)).toEqual(['1']);
    expect(searchLocalItems(items, 'coins before 1901 worth over $500').map(row => row.id)).toEqual(['2']);
    expect(smartCollections(items, []).unassigned.map(row => row.id)).toEqual(['1']);
  });
});
