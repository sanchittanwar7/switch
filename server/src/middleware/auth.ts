import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { db } from "../db";
import { users } from "../db/schema";
import { ensureUserWorkspace } from "../workspace";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export async function ensureUser(userId: string, email?: string): Promise<void> {
  await db
    .insert(users)
    .values({ id: userId, email: email ?? "" })
    .onConflictDoUpdate({
      target: users.id,
      set: { email: email ?? "", updatedAt: new Date() },
    });

  await ensureUserWorkspace(userId);
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Auth not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email;

  await ensureUser(data.user.id, data.user.email);

  next();
}
