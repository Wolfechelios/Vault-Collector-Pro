import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from '@vault/search';
import { SearchWorkspace } from './SearchWorkspace';

describe('Search Intelligence workspace', () => {
  it('renders parsed filters, smart collections, saved/recent search, and messy closet view', () => {
    const html = renderToStaticMarkup(<SearchWorkspace
      query="coins before 1900 worth over $500"
      parsed={parseSearchQuery('coins before 1900 worth over $500')}
      results={[]}
      view="closet"
      saved={[{ id: 'saved-1', name: 'Old valuable coins', queryText: 'coins before 1900 worth over $500', parsedQueryJson: '{}', isSmartCollection: false, createdAt: '', updatedAt: '' }]}
      history={[{ id: 'history-1', queryText: 'yellow DeWalt drill', parsedQueryJson: '{}', resultCount: 3, searchedAt: '' }]}
      onQueryChange={() => undefined}
      onSearch={() => undefined}
      onSave={() => undefined}
      onViewChange={() => undefined}
      onSmartCollection={() => undefined}
    />);

    expect(html).toContain('category: coins');
    expect(html).toContain('year: &lt; 1900');
    expect(html).toContain('value: &gt; $500.00');
    expect(html).toContain('Missing photos');
    expect(html).toContain('Review needed');
    expect(html).toContain('Old valuable coins');
    expect(html).toContain('yellow DeWalt drill');
    expect(html).toContain('Messy closet');
  });
});
