import { supabase } from '../database/client';

export async function logError(
  level: 'error' | 'warning' | 'info',
  message: string,
  error?: Error,
  context?: any,
  source: string = 'system'
): Promise<void> {
  try {
    await supabase
      .from('error_logs')
      .insert({
        level,
        message,
        error: error?.message,
        stack: error?.stack,
        context: context ? JSON.stringify(context) : null,
        source,
        timestamp: new Date().toISOString(),
      });
    
    // Also log to console
    const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    logMethod(`[${level.toUpperCase()}] ${message}`, error, context);
  } catch (err) {
    // Fallback to console if database logging fails
    console.error('Failed to log to database:', err);
    console.error(`[${level.toUpperCase()}] ${message}`, error, context);
  }
}

export async function logCronError(
  cronName: string,
  error: Error,
  context?: any
): Promise<void> {
  await logError('error', `Cron job ${cronName} failed: ${error.message}`, error, context, 'cron');
}

export async function logApiError(
  endpoint: string,
  error: Error,
  context?: any
): Promise<void> {
  await logError('error', `API endpoint ${endpoint} failed: ${error.message}`, error, context, 'api');
}

