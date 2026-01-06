import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '../../../config/env';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Require the cron secret so this endpoint isn't publicly callable
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const debug: any = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    // Check 1: API ID exists
    debug.checks.apiId = {
      exists: !!env.KALSHI_API_ID,
      length: env.KALSHI_API_ID?.length || 0,
      preview: env.KALSHI_API_ID ? env.KALSHI_API_ID.substring(0, 10) + '...' : 'MISSING',
    };

    // Check 2: Private Key exists and format
    const privateKey = env.KALSHI_PRIVATE_KEY || '';
    const normalizedKey = privateKey.replace(/\\n/g, '\n').trim();
    
    debug.checks.privateKey = {
      exists: !!privateKey,
      length: privateKey.length,
      normalizedLength: normalizedKey.length,
      hasBeginMarker: normalizedKey.includes('BEGIN') || normalizedKey.includes('BEGIN RSA PRIVATE KEY') || normalizedKey.includes('BEGIN PRIVATE KEY'),
      hasEndMarker: normalizedKey.includes('END'),
      firstLine: normalizedKey.split('\n')[0],
      lastLine: normalizedKey.split('\n').filter(l => l.trim()).slice(-1)[0],
      lineCount: normalizedKey.split('\n').length,
    };

    // Check 3: Try to parse the private key
    try {
      const keyObject = crypto.createPrivateKey(normalizedKey);
      debug.checks.keyParsing = {
        success: true,
        keyType: keyObject.asymmetricKeyType,
      };
    } catch (error: any) {
      debug.checks.keyParsing = {
        success: false,
        error: error.message,
      };
    }

    // Check 4: Test signature creation
    try {
      const testTimestamp = Date.now().toString();
      const testMethod = 'GET';
      const testPath = '/markets';
      const testMessage = `${testTimestamp}${testMethod}${testPath}`;
      
      const keyObject = crypto.createPrivateKey(normalizedKey);
      const testSignature = crypto.sign('sha256', Buffer.from(testMessage), {
        key: keyObject,
      });
      
      debug.checks.signatureTest = {
        success: true,
        timestamp: testTimestamp,
        method: testMethod,
        path: testPath,
        message: testMessage,
        signatureLength: testSignature.length,
        signatureBase64: testSignature.toString('base64').substring(0, 50) + '...',
      };
    } catch (error: any) {
      debug.checks.signatureTest = {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }

    // Check 5: Environment variable format
    debug.checks.envFormat = {
      rawKeyStartsWithQuote: privateKey.startsWith('"') || privateKey.startsWith("'"),
      rawKeyEndsWithQuote: privateKey.endsWith('"') || privateKey.endsWith("'"),
      hasEscapedNewlines: privateKey.includes('\\n'),
      hasRealNewlines: privateKey.includes('\n'),
    };

    return res.status(200).json(debug);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      debug,
    });
  }
}

