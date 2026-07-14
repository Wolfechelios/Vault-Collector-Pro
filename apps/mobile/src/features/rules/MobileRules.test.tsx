import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobileRules } from './MobileRules';

describe('mobile rules', () => {
  it('shows structured rule controls and influence', () => {
    const html = renderToStaticMarkup(<MobileRules rules={[{ id: 'r1', ruleKind: 'storage', conditionsJson: '{"field":"storagePath","category":"tools"}', actionJson: '{"value":"Garage / Shelf B"}', enabled: true, priority: 100, explanation: 'Store tools here', evidenceCount: 2 }]} onChange={() => undefined}/>);
    expect(html).toContain('Garage / Shelf B');
    expect(html).toContain('Category');
    expect(html).toContain('Save rule');
    expect(html).toContain('Disable rule');
    expect(html).toContain('Remove rule');
    expect(html).toContain('2 accepted corrections');
  });
});
