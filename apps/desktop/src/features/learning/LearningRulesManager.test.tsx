import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LearningRulesManager } from './LearningRulesManager';

describe('Learning Rules manager', () => {
  it('shows inspectable rule origin, count, state, and controls', () => {
    const html = renderToStaticMarkup(<LearningRulesManager rules={[{
      id: 'rule-1', ruleKind: 'alias', conditionsJson: '{"field":"brand","value":"DEW ALT"}',
      actionJson: '{"value":"DeWalt"}', priority: 100, evidenceCount: 4, enabled: true,
      explanation: 'Replace DEW ALT with DeWalt', createdAt: '2026-07-14T12:00:00.000Z',
      updatedAt: '2026-07-14T12:00:00.000Z'
    }]} onToggle={() => undefined} onDelete={() => undefined}/>);

    expect(html).toContain('Replace DEW ALT with DeWalt');
    expect(html).toContain('4 corrections');
    expect(html).toContain('Enabled');
    expect(html).toContain('Remove');
  });
});
