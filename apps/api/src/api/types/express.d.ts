import type { User } from "@stylaiize/shared";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      accessToken?: string;
    }
  }
}

export {};
