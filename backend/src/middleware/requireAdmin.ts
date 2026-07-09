import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Gate for every /api/admin/* route. Validates a shared secret supplied in the
 * `x-admin-key` header (or `Authorization: Bearer <key>`) against ADMIN_API_KEY
 * using a constant-time comparison. Without this, the admin API — which mints
 * live maker API keys and can (de)activate makers — is world-callable.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const ADMIN_KEY = process.env.ADMIN_API_KEY;

  if (!ADMIN_KEY) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_MISCONFIGURED', message: 'Admin key not configured' },
    });
    return;
  }

  const headerKey = req.headers['x-admin-key'];
  const provided =
    (typeof headerKey === 'string' ? headerKey : undefined) ||
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].slice(7)
      : undefined);

  if (!provided) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Admin key required' },
    });
    return;
  }

  // Constant-time comparison. Pad both sides to a fixed length so the compare
  // itself never leaks length information via early exit.
  try {
    const a = Buffer.from(provided.padEnd(128).slice(0, 128));
    const b = Buffer.from(ADMIN_KEY.padEnd(128).slice(0, 128));
    if (a.length !== b.length || !timingSafeEqual(a, b) || provided.length !== ADMIN_KEY.length) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid admin key' },
      });
      return;
    }
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid admin key' },
    });
    return;
  }

  next();
}
