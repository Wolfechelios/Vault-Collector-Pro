import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobileCategoryFields } from './MobileCategoryFields';

it('renders enabled imported select options', () => {
  const html = renderToStaticMarkup(<MobileCategoryFields definitions={[{
    category: 'tools', key: 'powerSource', label: 'Power source', kind: 'select', required: false,
    searchable: true, options: ['Battery', 'Corded'], aliases: [], order: 10, enabled: true
  }]} values={{}} onChange={() => undefined}/>);
  expect(html).toContain('Battery');
  expect(html).toContain('Corded');
});
