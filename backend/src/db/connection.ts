import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export async function connectDb(): Promise<void> {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(config.MONGODB_URI, {
        dbName: config.MONGODB_DB_NAME,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      logger.info('MongoDB connected', { uri: config.MONGODB_URI.replace(/\/\/.*@/, '//***@') });
      return;
    } catch (err) {
      attempt++;
      if (attempt >= MAX_RETRIES) {
        throw new Error(`MongoDB connection failed after ${MAX_RETRIES} attempts: ${err}`);
      }
      logger.warn(`MongoDB connection attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms`, { err });
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

export function getDbStatus(): 'connected' | 'disconnected' {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}
