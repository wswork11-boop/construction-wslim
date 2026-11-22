import { z } from 'zod';

export const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default('postgresql://construction:construction@localhost:5432/construction?schema=public'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(8).default('dev-access-secret-do-not-use-in-prod'),
  JWT_REFRESH_SECRET: z.string().min(8).default('dev-refresh-secret-do-not-use-in-prod'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SEED_OWNER_EMAIL: z.string().email().default('owner@example.com'),
  SEED_OWNER_PASSWORD: z.string().min(8).default('Password123!'),
  SEED_OWNER_NAME: z.string().min(1).default('Owner'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('ap-southeast-1'),
  S3_BUCKET: z.string().default('construction-dev'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string') {
      const stripped = v.trim().replace(/^["']|["']$/g, '');
      if (stripped !== '') {
        cleaned[k] = stripped;
      }
    } else if (v !== undefined) {
      cleaned[k] = v;
    }
  }
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${errors}`);
  }
  return parsed.data;
}
