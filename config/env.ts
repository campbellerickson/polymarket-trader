import { z } from 'zod';

// Allow either SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY (some dashboards set the latter)
const envSchema = z.object({
  // Kalshi
  KALSHI_API_ID: z.string().min(1),
  KALSHI_PRIVATE_KEY: z.string().min(1), // RSA private key in PEM format
  
  // Vercel AI Gateway
  // Accept any of the common env var names used by Vercel AI Gateway docs/SDK.
  VERCEL_AI_GATEWAY_KEY: z.string().min(1).optional(),
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  VERCEL_OIDC_TOKEN: z.string().min(1).optional(),
  
  // Database
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  
  // Security
  CRON_SECRET: z.string().min(1),
  
  // Trading Parameters
  DAILY_BUDGET: z.string().transform(Number).default('100'),
  MIN_ODDS: z.string().transform(Number).default('0.85'),
  MAX_ODDS: z.string().transform(Number).default('0.98'),
  MAX_DAYS_TO_RESOLUTION: z.string().transform(Number).default('2'),
  MIN_LIQUIDITY: z.string().transform(Number).default('2000'),
  
  // Safety
  DRY_RUN: z.string().transform(v => v === 'true').default('false'),
  INITIAL_BANKROLL: z.string().transform(Number).default('1000'),
});

type ParsedEnv = z.infer<typeof envSchema>;
export type Env = Omit<
  ParsedEnv,
  'SUPABASE_SERVICE_ROLE_KEY' | 'AI_GATEWAY_API_KEY' | 'VERCEL_OIDC_TOKEN'
> & { SUPABASE_KEY: string; VERCEL_AI_GATEWAY_KEY: string };

export function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    const supabaseKey = parsed.SUPABASE_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseKey) {
      throw new Error('Missing SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
    }

    const aiGatewayKey =
      parsed.VERCEL_AI_GATEWAY_KEY || parsed.AI_GATEWAY_API_KEY || parsed.VERCEL_OIDC_TOKEN;
    if (!aiGatewayKey) {
      throw new Error('Missing VERCEL_AI_GATEWAY_KEY (or AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN)');
    }
    return {
      ...parsed,
      SUPABASE_KEY: supabaseKey,
      VERCEL_AI_GATEWAY_KEY: aiGatewayKey,
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missing}`);
    }
    throw error;
  }
}

export const env = validateEnv();

