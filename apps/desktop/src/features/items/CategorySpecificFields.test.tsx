import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CategorySpecificFields } from './CategorySpecificFields';

describe('CategorySpecificFields', () => {
  it('renders tool fields from the category schema and marks protected edits', () => {
    const html = renderToStaticMarkup(<CategorySpecificFields
      category="tools"
      definitions={[
        { category: 'tools', key: 'voltage', label: 'Voltage', kind: 'text', required: false, searchable: true, options: [], aliases: [], order: 20, enabled: true },
        { category: 'tools', key: 'powerSource', label: 'Power source', kind: 'select', required: false, searchable: true, options: ['Battery'], aliases: [], order: 30, enabled: true },
        { category: 'tools', key: 'hidden', label: 'Hidden', kind: 'text', required: false, searchable: true, options: [], aliases: [], order: 10, enabled: false }
      ]}
      values={{ voltage: '20V' }}
      protectedFields={['voltage']}
      onChange={() => undefined}
    />);
    expect(html).toContain('Voltage');
    expect(html).toContain('Power source');
    expect(html).toContain('20V');
    expect(html).toContain('Protected manual value');
    expect(html).not.toContain('Hidden');
  });
});
