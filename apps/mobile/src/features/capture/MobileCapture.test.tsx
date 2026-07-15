import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {MobileCapture, analyzeCapture} from './MobileCapture';

describe('PWA mobile capture', () => {
  it('offers the rear camera through a normal browser file input', () => {
    const html = renderToStaticMarkup(<MobileCapture schemas={[]} onCapture={() => undefined}/>);
    expect(html).toContain('accept="image/*"');
    expect(html).toContain('capture="environment"');
  });

  it('falls back to pasted text when web recognition fails', async () => {
    const result = await analyzeCapture('DEWALT\nMODEL DCD791', ['photo'], async () => { throw new Error('model offline'); });
    expect(result.candidate.fields).toContainEqual(expect.objectContaining({field: 'brand', value: 'DeWalt'}));
    expect(result.warning).toContain('model offline');
  });
});
