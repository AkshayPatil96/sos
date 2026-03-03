import morgan from 'morgan';
import type { Request, RequestHandler } from 'express';
import { logger } from '@/shared/utils/logger';

const stream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

const skip = (req: Request): boolean => {
  return req.url === '/health';
};

export const morganMiddleware: RequestHandler = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip },
) as RequestHandler;
