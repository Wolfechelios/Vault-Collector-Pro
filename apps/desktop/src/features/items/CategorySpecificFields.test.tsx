import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CategorySpecificFields } from './CategorySpecificFields';

describe('CategorySpecificFields', () => {
  it('renders tool fields from the category schema and marks protected edits', () => {
    const html = renderToStaticMarkup(<CategorySpecificFields
      category="tools"
      values={{ voltage: '20V' }}
      protectedFields={['voltage']}
      onChange={() => undefined}
    />);
    expect(html).toContain('Voltage');
    expect(html).toContain('Power source');
    expect(html).toContain('20V');
    expect(html).toContain('Protected manual value');
  });
});
