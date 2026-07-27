import { Router } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { columns, cards, comments } from "../db/schema.js";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

router.get("/", async (req, res) => {
  const userId = getUserId(req);

  const allColumns = await db
    .select()
    .from(columns)
    .orderBy(asc(columns.position));

  const allCards = await db
    .select()
    .from(cards)
    .where(eq(cards.userId, userId))
    .orderBy(asc(cards.position));

  const cardIds = allCards.map((c) => c.id);
  const allComments = cardIds.length > 0
    ? await db
        .select()
        .from(comments)
        .where(and(eq(comments.userId, userId)))
        .orderBy(asc(comments.createdAt))
    : [];

  const cardsWithComments = allCards.map((card) => ({
    ...card,
    comments: allComments.filter((c) => c.cardId === card.id),
  }));

  const result = {
    columns: allColumns.map((col) => ({
      ...col,
      cardIds: cardsWithComments
        .filter((c) => c.columnId === col.id)
        .map((c) => c.id),
    })),
    cards: Object.fromEntries(
      cardsWithComments.map((card) => [card.id, card])
    ),
  };

  res.json(result);
});

router.put("/", async (req, res) => {
  const userId = getUserId(req);
  const { columns: updatedColumns } = req.body;

  if (!updatedColumns || !Array.isArray(updatedColumns)) {
    res.status(400).json({ error: "Missing required field: columns (array)" });
    return;
  }

  for (const col of updatedColumns) {
    if (col.cardIds && Array.isArray(col.cardIds)) {
      for (let i = 0; i < col.cardIds.length; i++) {
        await db
          .update(cards)
          .set({ columnId: col.id, position: i, updatedAt: new Date() })
          .where(and(eq(cards.id, col.cardIds[i]), eq(cards.userId, userId)));
      }
    }
  }

  res.json({ success: true });
});

router.post("/cards", async (req, res) => {
  const userId = getUserId(req);
  const { company, role, jobUrl, resumePath, tags, columnId } = req.body;

  if (!company || !role || !columnId) {
    res.status(400).json({ error: "Missing required fields: company, role, columnId" });
    return;
  }

  const [maxPos] = await db
    .select({ max: cards.position })
    .from(cards)
    .where(and(eq(cards.columnId, columnId), eq(cards.userId, userId)))
    .orderBy(asc(cards.position));

  const nextPosition = (maxPos?.max ?? -1) + 1;

  const [created] = await db
    .insert(cards)
    .values({
      userId,
      company,
      role,
      jobUrl: jobUrl?.trim() || null,
      resumePath: resumePath?.trim() || null,
      tags: Array.isArray(tags) ? tags : [],
      columnId,
      position: nextPosition,
    })
    .returning();

  res.status(201).json({ ...created, comments: [] });
});

router.patch("/cards/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const updates: Record<string, unknown> = {};

  const allowedFields = ["company", "role", "jobUrl", "resumePath", "tags", "columnId"];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(cards)
    .set(updates)
    .where(and(eq(cards.id, id), eq(cards.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const cardComments = await db
    .select()
    .from(comments)
    .where(eq(comments.cardId, id))
    .orderBy(asc(comments.createdAt));

  res.json({ ...updated, comments: cardComments });
});

router.delete("/cards/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const [deleted] = await db
    .delete(cards)
    .where(and(eq(cards.id, id), eq(cards.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  res.json({ success: true });
});

router.post("/cards/:id/comments", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const { text } = req.body;

  if (!text) {
    res.status(400).json({ error: "Missing required field: text" });
    return;
  }

  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, id), eq(cards.userId, userId)));
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const [created] = await db
    .insert(comments)
    .values({ cardId: id, userId, text })
    .returning();

  res.status(201).json(created);
});

router.delete("/comments/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const [deleted] = await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
