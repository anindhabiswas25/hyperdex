import { Application } from 'express';
import healthRouter from './health';
import quoteRouter from './quote';
import makersRouter from './makers';
import tradesRouter from './trades';
import adminRouter from './admin';
import adminPendingRouter from './adminPending';
import { requireAdmin } from '../middleware/requireAdmin';

export function mountRoutes(app: Application): void {
  app.use(healthRouter);
  app.use(quoteRouter);
  app.use(makersRouter);
  app.use(tradesRouter);

  // Guard every /api/admin/* request. The admin routers below register their
  // routes on absolute /api/admin/... paths, so this path-scoped middleware
  // runs for all of them without altering their mount prefix.
  app.use('/api/admin', requireAdmin);
  app.use(adminRouter);
  app.use(adminPendingRouter);
}
