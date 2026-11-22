import { z } from 'zod';
import { AppException } from './errors';

export function parseWithZod<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw AppException.unprocessable(
      'VALIDATION_ERROR',
      'Validation failed',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}
