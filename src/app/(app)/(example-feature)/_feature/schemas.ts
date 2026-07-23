import { z } from "zod";

export const exampleRecordSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(120),
  created_at: z.iso.datetime({ offset: true }),
});

export const exampleListSchema = z.object({
  records: z.array(exampleRecordSchema).max(100),
});

export const createExampleInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  idempotency_key: z.uuid(),
});

export const createExampleResponseSchema = z.object({
  record: exampleRecordSchema,
});

export type ExampleRecord = z.infer<typeof exampleRecordSchema>;
export type ExampleList = z.infer<typeof exampleListSchema>;
