declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        jti: string;
      };
      requestId?: string;
    }
  }
}

export {};
