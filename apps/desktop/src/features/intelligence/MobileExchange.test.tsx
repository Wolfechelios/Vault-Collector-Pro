import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobileExchange } from './MobileExchange';
describe('desktop mobile intelligence exchange',()=>{it('shows private export, import, and conflict result controls',()=>{const html=renderToStaticMarkup(<MobileExchange onConflicts={()=>undefined}/>);expect(html).toContain('Export intelligence snapshot');expect(html).toContain('Import mobile changes');expect(html).toContain('private inventory');expect(html).toContain('data-testid="mobile-change-import"');});});
