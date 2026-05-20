import { Application } from 'express';
import healthRouter from './health';
import quoteRouter from './quote';
import makersRouter from './makers';
import tradesRouter from './trades';
import adminRouter from './admin';
import adminPendingRouter from './adminPending';

export function mountRoutes(app: Application): void {
  app.use(healthRouter);
  app.use(quoteRouter);
  app.use(makersRouter);
  app.use(tradesRouter);
  app.use(adminRouter);
  app.use(adminPendingRouter);
}
