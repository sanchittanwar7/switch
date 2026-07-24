import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import { columns, cards, comments } from "../db/schema";

const router = Router();

router.get("/", async (_req, res) => {
  const allColumns = await db
    .select()
    .from(columns)
    .orderBy(asc(columns.position));

  const allCards = await db
    .select()
    .from(cards)
    .orderBy(asc(cards.position));

  const allComments = await db
    .select()
    .from(comments)
    .orderBy(asc(comments.createdAt));

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
          .where(eq(cards.id, col.cardIds[i]));
      }
    }
  }

  res.json({ success: true });
});

router.post("/cards", async (req, res) => {
  const { company, role, jobUrl, resumePath, tags, columnId } = req.body;

  if (!company || !role || !columnId) {
    res.status(400).json({ error: "Missing required fields: company, role, columnId" });
    return;
  }

  const [maxPos] = await db
    .select({ max: cards.position })
    .from(cards)
    .where(eq(cards.columnId, columnId))
    .orderBy(asc(cards.position));

  const nextPosition = (maxPos?.max ?? -1) + 1;

  const [created] = await db
    .insert(cards)
    .values({
      company,
      role,
      jobUrl: jobUrl || null,
      resumePath: resumePath || null,
      tags: tags || [],
      columnId,
      position: nextPosition,
    })
    .returning();

  res.status(201).json({ ...created, comments: [] });
});

router.patch("/cards/:id", async (req, res) => {
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
    .where(eq(cards.id, id))
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
  const { id } = req.params;

  const [deleted] = await db
    .delete(cards)
    .where(eq(cards.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  res.json({ success: true });
});

router.post("/cards/:id/comments", async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text) {
    res.status(400).json({ error: "Missing required field: text" });
    return;
  }

  const [card] = await db.select().from(cards).where(eq(cards.id, id));
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const [created] = await db
    .insert(comments)
    .values({ cardId: id, text })
    .returning();

  res.status(201).json(created);
});

router.delete("/comments/:id", async (req, res) => {
  const { id } = req.params;

  const [deleted] = await db
    .delete(comments)
    .where(eq(comments.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
