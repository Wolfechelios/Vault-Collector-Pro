import { z } from 'zod';

export const ItemStatusSchema = z.enum([
  'private',
  'draft',
  'listed',
  'sold',
  'archived'
]);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

export const MoneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string().length(3).transform((value) => value.toUpperCase())
});
export type Money = z.infer<typeof MoneySchema>;

export const MediaRefSchema = z.object({
  id: z.string().min(1),
  originalPath: z.string().min(1),
  thumbnailPath: z.string().nullable(),
  contentHash: z.string().min(32),
  mimeType: z.string().min(1),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  position: z.number().int().nonnegative()
});
export type MediaRef = z.infer<typeof MediaRefSchema>;

export const FieldEvidenceSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  sourceMediaId: z.string().nullable(),
  rawText: z.string().nullable(),
  verified: z.boolean()
});
export type FieldEvidence = z.infer<typeof FieldEvidenceSchema>;

export const ItemRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().nullable().optional(),
  status: ItemStatusSchema.default('private'),
  condition: z.string().min(1),
  conditionNotes: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  quantity: z.number().int().positive().default(1),
  sku: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  year: z.number().int().min(0).max(9999).nullable().optional(),
  edition: z.string().nullable().optional(),
  purchasePrice: MoneySchema.nullable().optional(),
  medianValue: MoneySchema.nullable().optional(),
  suggestedPrice: MoneySchema.nullable().optional(),
  minimumPrice: MoneySchema.nullable().optional(),
  storageLocationId: z.string().nullable().optional(),
  acquiredAt: z.string().datetime().nullable().optional(),
  soldAt: z.string().datetime().nullable().optional(),
  soldPrice: MoneySchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  specifics: z.record(z.string(), z.string()),
  media: z.array(MediaRefSchema),
  evidence: z.array(FieldEvidenceSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type ItemRecord = z.infer<typeof ItemRecordSchema>;
