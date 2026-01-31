import { z } from 'zod';

export const importRequestSchema = z.object({
  type: z.enum(['STUDENT', 'TEACHER']),
  dryRun: z.preprocess((value) => value === 'true' || value === true, z.boolean()).optional(),
  schoolId: z.string().uuid().optional(),
});

export type ImportRequest = z.infer<typeof importRequestSchema>;
