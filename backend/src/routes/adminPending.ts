import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PendingMaker } from '../db/models/PendingMaker';
import { Maker } from '../db/models/Maker';
import { ApiKey } from '../db/models/ApiKey';
import { config } from '../config';

const router = Router();

// ── GET /api/admin/pending ─────────────────────────────────────────────────────

router.get('/api/admin/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status && typeof status === 'string') filter.status = status;

    const applications = await PendingMaker.find(filter)
      .select('-generatedApiKey -__v')
      .sort({ submittedAt: -1 })
      .lean();

    res.json({ applications, total: applications.length });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/pending/:id/approve ────────────────────────────────────────

router.post('/api/admin/pending/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await PendingMaker.findById(req.params.id);
    if (!pending) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }
    if (pending.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Already processed' });
      return;
    }

    const maker = await Maker.create({
      stellarAddress: pending.stellarAddress,
      name: pending.name,
      signerPublicKey: '',
      active: true,
      supportedPairs: pending.requestedPairs,
      connectionStatus: 'unknown',
      totalVolume: 0,
      totalTrades: 0,
      totalFeesEarned: 0,
    });

    const rawKey = 'sk_live_' + crypto.randomBytes(32).toString('hex');
    const keyHash = await bcrypt.hash(rawKey, config.API_KEY_SALT_ROUNDS);
    const keyPrefix = rawKey.slice(0, 15);

    await ApiKey.create({
      makerId: maker._id,
      keyHash,
      keyPrefix,
      label: 'Default',
      active: true,
    });

    pending.status = 'approved';
    pending.makerId = maker._id as unknown as import('mongoose').Types.ObjectId;
    pending.generatedApiKey = rawKey;
    pending.apiKeyGeneratedAt = new Date();
    pending.reviewedAt = new Date();
    await pending.save();

    res.json({
      success: true,
      apiKey: rawKey,
      makerId: maker._id,
      makerName: maker.name,
      makerAddress: maker.stellarAddress,
      message: 'Maker approved. Copy the API key and send to maker. It will not be shown again after 24 hours.',
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/pending/:id/apikey ──────────────────────────────────────────

router.get('/api/admin/pending/:id/apikey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await PendingMaker.findById(req.params.id);
    if (!pending) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }
    if (pending.status !== 'approved') {
      res.status(400).json({ success: false, error: 'Application is not in approved state' });
      return;
    }
    if (!pending.generatedApiKey || !pending.apiKeyGeneratedAt) {
      res.status(410).json({
        success: false,
        error: 'API key window expired',
        message: '24-hour window passed. Use rotate key to generate a new one.',
      });
      return;
    }

    const hoursSince = (Date.now() - pending.apiKeyGeneratedAt.getTime()) / 3_600_000;
    if (hoursSince > 24) {
      pending.generatedApiKey = null;
      await pending.save();
      res.status(410).json({
        success: false,
        error: 'API key window expired',
        message: '24-hour window passed. Use rotate key to generate a new one.',
      });
      return;
    }

    res.json({
      success: true,
      apiKey: pending.generatedApiKey,
      expiresIn: Math.floor(24 - hoursSince) + ' hours',
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/pending/:id/reject ─────────────────────────────────────────

router.post('/api/admin/pending/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await PendingMaker.findById(req.params.id);
    if (!pending) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }
    if (pending.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Already processed' });
      return;
    }

    pending.status = 'rejected';
    pending.adminNotes = req.body.reason ?? null;
    pending.reviewedAt = new Date();
    await pending.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/pending/:id/rotate-key ─────────────────────────────────────

router.post('/api/admin/pending/:id/rotate-key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await PendingMaker.findById(req.params.id);
    if (!pending || pending.status !== 'approved') {
      res.status(404).json({ success: false, error: 'Approved application not found' });
      return;
    }
    if (!pending.makerId) {
      res.status(400).json({ success: false, error: 'No maker associated with this application' });
      return;
    }

    // Deactivate old key
    await ApiKey.updateMany({ makerId: pending.makerId }, { $set: { active: false } });

    const rawKey = 'sk_live_' + crypto.randomBytes(32).toString('hex');
    const keyHash = await bcrypt.hash(rawKey, config.API_KEY_SALT_ROUNDS);
    const keyPrefix = rawKey.slice(0, 15);

    await ApiKey.create({ makerId: pending.makerId, keyHash, keyPrefix, label: 'Rotated', active: true });

    pending.generatedApiKey = rawKey;
    pending.apiKeyGeneratedAt = new Date();
    await pending.save();

    res.json({
      success: true,
      apiKey: rawKey,
      message: 'New API key generated. Copy and send to maker.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
