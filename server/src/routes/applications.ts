import { Router } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db } from "../db";
import { applications, comments, interviews, columns } from "../db/schema";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

router.get("/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const [application] = await db
    .select({
      id: applications.id,
      userId: applications.userId,
      company: applications.company,
      role: applications.role,
      jobUrl: applications.jobUrl,
      resumePath: applications.resumePath,
      tags: applications.tags,
      columnId: applications.columnId,
      position: applications.position,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      columnTitle: columns.title,
    })
    .from(applications)
    .leftJoin(columns, eq(applications.columnId, columns.id))
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));

  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const applicationComments = await db
    .select()
    .from(comments)
    .where(eq(comments.applicationId, id))
    .orderBy(asc(comments.createdAt));

  let applicationInterviews: (typeof interviews.$inferSelect)[] = [];
  try {
    applicationInterviews = await db
      .select()
      .from(interviews)
      .where(eq(interviews.applicationId, id))
      .orderBy(asc(interviews.createdAt));
  } catch (err) {
    console.error("Failed to fetch interviews:", (err as any)?.cause?.message || (err as any)?.message || err);
  }

  res.json({
    ...application,
    comments: applicationComments,
    interviews: applicationInterviews,
  });
});

router.get("/:id/interviews", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));

  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const applicationInterviews = await db
    .select()
    .from(interviews)
    .where(eq(interviews.applicationId, id))
    .orderBy(asc(interviews.createdAt));

  res.json({ interviews: applicationInterviews });
});

router.post("/:id/interviews", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const { type, status, scheduledAt, questionTitle, feedback, questionDetail } = req.body;

  if (!type) {
    res.status(400).json({ error: "Missing required field: type" });
    return;
  }

  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));

  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [created] = await db
    .insert(interviews)
    .values({
      applicationId: id,
      type,
      status: status || "scheduled",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      questionTitle: questionTitle?.trim() || null,
      feedback: feedback?.trim() || null,
      questionDetail: questionDetail?.trim() || null,
    })
    .returning();

  res.status(201).json(created);
});

router.patch("/:id/interviews/:interviewId", async (req, res) => {
  const userId = getUserId(req);
  const { id, interviewId } = req.params;

  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));

  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const allowedFields = ["type", "status", "scheduledAt", "questionTitle", "feedback", "questionDetail"];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      if (field === "scheduledAt" && req.body[field] !== null) {
        updates[field] = new Date(req.body[field]);
      } else if (field === "questionTitle" || field === "feedback" || field === "questionDetail") {
        updates[field] = req.body[field]?.trim?.() ?? req.body[field];
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(interviews)
    .set(updates)
    .where(and(eq(interviews.id, interviewId), eq(interviews.applicationId, id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  res.json(updated);
});

router.delete("/:id/interviews/:interviewId", async (req, res) => {
  const userId = getUserId(req);
  const { id, interviewId } = req.params;

  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));

  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [deleted] = await db
    .delete(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.applicationId, id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
