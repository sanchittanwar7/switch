import { Router } from "express";
import { authMiddleware, ensureUser } from "../middleware/auth";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/me", authMiddleware, async (req, res) => {
  const userId = req.userId!;

  await ensureUser(userId, req.userEmail);

  const [user] = await db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

export default router;
