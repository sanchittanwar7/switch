import { Router } from "express";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { db } from "../db";
import { events } from "../db/schema";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

router.get("/", async (req, res) => {
  const userId = getUserId(req);
  const { start, end } = req.query;

  if (typeof start !== "string" || typeof end !== "string") {
    res.status(400).json({ error: "Missing required query params: start, end (ISO strings)" });
    return;
  }

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);

  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    res.status(400).json({ error: "Invalid date format. Use ISO 8601 strings." });
    return;
  }

  const userEvents = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        gte(events.endTime, rangeStart),
        lte(events.startTime, rangeEnd),
      ),
    )
    .orderBy(asc(events.startTime));

  res.json(userEvents);
});

router.post("/", async (req, res) => {
  const userId = getUserId(req);
  const { name, description, startTime, endTime, company, role, roundName, resumePath, jobUrl } =
    req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Missing required field: name" });
    return;
  }

  if (!startTime || !endTime) {
    res.status(400).json({ error: "Missing required fields: startTime, endTime" });
    return;
  }

  const start = new Date(startTime);
  const endD = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(endD.getTime())) {
    res.status(400).json({ error: "Invalid date format for startTime or endTime" });
    return;
  }

  if (start >= endD) {
    res.status(400).json({ error: "startTime must be before endTime" });
    return;
  }

  const [created] = await db
    .insert(events)
    .values({
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      startTime: start,
      endTime: endD,
      company: company?.trim() || null,
      role: role?.trim() || null,
      roundName: roundName?.trim() || null,
      resumePath: resumePath?.trim() || null,
      jobUrl: jobUrl?.trim() || null,
    })
    .returning();

  res.status(201).json(created);
});

router.patch("/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const updates: Record<string, unknown> = {};

  const allowedFields = [
    "name",
    "description",
    "startTime",
    "endTime",
    "company",
    "role",
    "roundName",
    "resumePath",
    "jobUrl",
  ];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (updates.startTime) {
    const start = new Date(updates.startTime as string);
    if (isNaN(start.getTime())) {
      res.status(400).json({ error: "Invalid date format for startTime" });
      return;
    }
    updates.startTime = start;
  }

  if (updates.endTime) {
    const end = new Date(updates.endTime as string);
    if (isNaN(end.getTime())) {
      res.status(400).json({ error: "Invalid date format for endTime" });
      return;
    }
    updates.endTime = end;
  }

  if (updates.startTime || updates.endTime) {
    const [existing] = await db
      .select({ startTime: events.startTime, endTime: events.endTime })
      .from(events)
      .where(and(eq(events.id, id), eq(events.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const effectiveStart = (updates.startTime as Date) ?? existing.startTime;
    const effectiveEnd = (updates.endTime as Date) ?? existing.endTime;

    if (effectiveStart >= effectiveEnd) {
      res.status(400).json({ error: "startTime must be before endTime" });
      return;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(events)
    .set(updates)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const [deleted] = await db
    .delete(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
