import { z } from 'zod';
import { ItemRecordSchema } from './item';

export const AppHealthSchema = z.object({
  app: z.literal('vault-catalogue'),
  version: z.string(),
  databaseReady: z.boolean()
});
export type AppHealth = z.infer<typeof AppHealthSchema>;

export const CreateItemPayloadSchema = ItemRecordSchema.omit({
  createdAt: true,
  updatedAt: true
});
export type CreateItemPayload = z.infer<typeof CreateItemPayloadSchema>;

export const SearchItemsPayloadSchema = z.object({
  query: z.string().default(''),
  category: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().nonnegative().default(0)
});
export type SearchItemsPayload = z.infer<typeof SearchItemsPayloadSchema>;
