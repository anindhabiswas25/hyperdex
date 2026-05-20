import { Router, Request, Response, NextFunction } from 'express';
import { Maker } from '../db/models/Maker';
import { NotFoundError } from '../utils/errors';

const router = Router();

router.get('/api/admin/makers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const makers = await Maker.find()
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ makers });
  } catch (err) {
    next(err);
  }
});

router.patch('/api/admin/makers/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const maker = await Maker.findByIdAndUpdate(req.params.id, { active: true }, { new: true }).lean();
    if (!maker) throw new NotFoundError('Maker not found');
    res.json({ success: true, maker });
  } catch (err) {
    next(err);
  }
});

router.patch('/api/admin/makers/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const maker = await Maker.findByIdAndUpdate(req.params.id, { active: false }, { new: true }).lean();
    if (!maker) throw new NotFoundError('Maker not found');
    res.json({ success: true, maker });
  } catch (err) {
    next(err);
  }
});

export default router;
