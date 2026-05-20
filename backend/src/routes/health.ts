import { Router } from 'express';
import { getDbStatus } from '../db/connection';
import { MakerConnectionRegistry } from '../websocket/MakerConnection';
import { PriceBook } from '../pricebook/PriceBook';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeMakers: MakerConnectionRegistry.getInstance().getActiveMakers().length,
    priceBookEntries: PriceBook.getInstance().totalEntries,
    dbStatus: getDbStatus(),
    timestamp: Date.now(),
  });
});

export default router;
