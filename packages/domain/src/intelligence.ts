import { z } from 'zod';

export const EvidenceSourceKindSchema = z.enum([
  'ocr',
  'barcode',
  'logo',
  'object',
  'metadata',
  'user',
  'learned-rule'
]);
export type EvidenceSourceKind = z.infer<typeof EvidenceSourceKindSchema>;

export const EvidenceBoundsSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1)
});
export type EvidenceBounds = z.infer<typeof EvidenceBoundsSchema>;

export const ScanEvidenceSchema = z.object({
  id: z.string().min(1),
  scanId: z.string().min(1),
  itemId: z.string().min(1).nullable().optional(),
  field: z.string().min(1),
  value: z.string(),
  normalizedValue: z.string(),
  confidence: z.number().min(0).max(1),
  sourceKind: EvidenceSourceKindSchema,
  sourceMediaId: z.string().min(1).nullable(),
  rawText: z.string().nullable(),
  bounds: EvidenceBoundsSchema.nullable(),
  provider: z.string().min(1).nullable().optional(),
  createdAt: z.string().datetime()
});
export type ScanEvidence = z.infer<typeof ScanEvidenceSchema>;

export const VerificationStateSchema = z.enum([
  'unverified',
  'flagged',
  'verified',
  'rejected'
]);
export type VerificationState = z.infer<typeof VerificationStateSchema>;

export const SuggestionDispositionSchema = z.enum([
  'auto-applied',
  'flagged',
  'review'
]);
export type SuggestionDisposition = z.infer<typeof SuggestionDispositionSchema>;

export const SuggestionStatusSchema = z.enum([
  'pending',
  'accepted',
  'edited',
  'rejected',
  'applied'
]);
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;

export const FieldSuggestionSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  field: z.string().min(1),
  proposedValue: z.string(),
  confidence: z.number().min(0).max(1),
  disposition: SuggestionDispositionSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  conflictingEvidenceIds: z.array(z.string().min(1)),
  influencedByRuleIds: z.array(z.string().min(1)),
  verificationState: VerificationStateSchema,
  status: SuggestionStatusSchema,
  protectedValue: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable().optional()
});
export type FieldSuggestion = z.infer<typeof FieldSuggestionSchema>;

export const ItemFieldSourceSchema = z.enum(['user', 'inference', 'import']);
export type ItemFieldSource = z.infer<typeof ItemFieldSourceSchema>;

export const ItemFieldStateSchema = z.object({
  itemId: z.string().min(1),
  field: z.string().min(1),
  value: z.string(),
  source: ItemFieldSourceSchema,
  protected: z.boolean(),
  verificationState: VerificationStateSchema,
  confidence: z.number().min(0).max(1).nullable(),
  evidenceIds: z.array(z.string().min(1)),
  suggestionId: z.string().min(1).nullable(),
  updatedAt: z.string().datetime()
});
export type ItemFieldState = z.infer<typeof ItemFieldStateSchema>;

export const CategoryFieldKindSchema = z.enum([
  'text',
  'number',
  'select',
  'identifier',
  'color',
  'material',
  'condition'
]);
export type CategoryFieldKind = z.infer<typeof CategoryFieldKindSchema>;

export const CategoryFieldDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: CategoryFieldKindSchema,
  required: z.boolean().default(false),
  searchable: z.boolean().default(true),
  options: z.array(z.string().min(1)).default([]),
  aliases: z.array(z.string().min(1)).default([]),
  order: z.number().int().nonnegative()
});
export type CategoryFieldDefinition = z.infer<typeof CategoryFieldDefinitionSchema>;
