import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CategorySchemaManager } from './CategorySchemaManager';

describe('CategorySchemaManager', () => {
  it('exposes editable, disable, and remove controls', () => {
    const html = renderToStaticMarkup(<CategorySchemaManager schemas={[{
      category: 'tools', key: 'voltage', label: 'Voltage', kind: 'text', required: false,
      searchable: true, options: [], aliases: [], order: 10, enabled: true
    }]} onSave={() => undefined} onDelete={() => undefined}/>);
    expect(html).toContain('Voltage');
    expect(html).toContain('Disable field');
    expect(html).toContain('Remove definition');
  });
});
