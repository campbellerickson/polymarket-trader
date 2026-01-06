import { z } from 'zod';

const envSchema = z.object({
  // Kalshi
  KALSHI_API_ID: z.string().min(1),
  KALSHI_PRIVATE_KEY: z.string().min(1), // RSA private key in PEM format
  
  // Vercel AI Gateway
  VERCEL_AI_GATEWAY_KEY: z.string().min(1),
  
  // Database
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
  
  // Security
  CRON_SECRET: z.string().min(1),
  
  // Trading Parameters
  DAILY_BUDGET: z.string().transform(Number).default('100'),
  MIN_ODDS: z.string().transform(Number).default('0.90'),
  MAX_ODDS: z.string().transform(Number).default('0.98'),
  MAX_DAYS_TO_RESOLUTION: z.string().transform(Number).default('2'),
  MIN_LIQUIDITY: z.string().transform(Number).default('10000'),
  
  // Safety
  DRY_RUN: z.string().transform(v => v === 'true').default('false'),
  INITIAL_BANKROLL: z.string().transform(Number).default('1000'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missing}`);
    }
    throw error;
  }
}

export const env = validateEnv();

