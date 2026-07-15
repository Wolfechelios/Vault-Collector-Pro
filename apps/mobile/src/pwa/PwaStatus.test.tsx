import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {PwaStatusView} from './PwaStatus';

describe('PWA status', () => {
  it('shows offline and opt-in update states', () => {
    const html = renderToStaticMarkup(<PwaStatusView offline updateReady onUpdate={() => undefined}/>);
    expect(html).toContain('Offline');
    expect(html).toContain('Update ready');
    expect(html).toContain('Reload');
  });
});
