import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user_id?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.JWT_SECRET;
  const authorization = req.header("authorization");

  if (!secret || !authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authorization.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, secret);

    if (typeof payload !== "object" || typeof payload.user_id !== "string" || !payload.user_id) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    req.user_id = payload.user_id;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}
