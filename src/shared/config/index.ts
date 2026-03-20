import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number).pipe(z.number().min(1).max(65535)),
  APP_NAME: z.string().min(1),
  API_VERSION: z.string().default('v1'),
  FRONTEND_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  DB_POOL_MIN: z.string().default('2').transform(Number),
  DB_POOL_MAX: z.string().default('10').transform(Number),

  JWT_ACCESS_SECRET: z.string().min(32, 'Must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Must be at least 32 characters'),

  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_PRESIGNED_URL_EXPIRY: z.string().default('900').transform(Number),

  SENTRY_DSN: z.string().url().optional(),
  ENABLE_MONITORING: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'http', 'warn', 'error']).default('info'),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  // Email (AWS SES)
  SES_FROM_EMAIL: z.string().email().optional(),
  SES_FROM_NAME: z.string().min(1).default('Student Onboarding System'),

  // Token expiry
  PASSWORD_RESET_EXPIRES_MIN: z.string().default('60').transform(Number),
  EMAIL_VERIFY_EXPIRES_HOURS: z.string().default('24').transform(Number),
  INVITE_TOKEN_EXPIRES_HOURS: z.string().default('72').transform(Number),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  // Logger not yet available at config parse time — console is intentional here

  console.error('❌ Invalid environment variables:');

  console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config = result.data;
export type Config = typeof config;
