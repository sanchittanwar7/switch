import { Router } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db } from "../db";
import { columns, applications, comments } from "../db/schema";

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

  const allApplications = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(asc(applications.position));

  const applicationIds = allApplications.map((a) => a.id);
  const allComments = applicationIds.length > 0
    ? await db
        .select()
        .from(comments)
        .where(and(eq(comments.userId, userId)))
        .orderBy(asc(comments.createdAt))
    : [];

  const applicationsWithComments = allApplications.map((application) => ({
    ...application,
    comments: allComments.filter((c) => c.applicationId === application.id),
  }));

  const result = {
    columns: allColumns.map((col) => ({
      ...col,
      applicationIds: applicationsWithComments
        .filter((a) => a.columnId === col.id)
        .map((a) => a.id),
    })),
    applications: Object.fromEntries(
      applicationsWithComments.map((a) => [a.id, a])
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
    if (col.applicationIds && Array.isArray(col.applicationIds)) {
      for (let i = 0; i < col.applicationIds.length; i++) {
        await db
          .update(applications)
          .set({ columnId: col.id, position: i, updatedAt: new Date() })
          .where(and(eq(applications.id, col.applicationIds[i]), eq(applications.userId, userId)));
      }
    }
  }

  res.json({ success: true });
});

router.post("/applications", async (req, res) => {
  const userId = getUserId(req);
  const { company, role, jobUrl, resumePath, tags, columnId } = req.body;

  if (!company || !role || !columnId) {
    res.status(400).json({ error: "Missing required fields: company, role, columnId" });
    return;
  }

  const [maxPos] = await db
    .select({ max: applications.position })
    .from(applications)
    .where(and(eq(applications.columnId, columnId), eq(applications.userId, userId)))
    .orderBy(asc(applications.position));

  const nextPosition = (maxPos?.max ?? -1) + 1;

  const [created] = await db
    .insert(applications)
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

router.patch("/applications/:id", async (req, res) => {
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
    .update(applications)
    .set(updates)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const applicationComments = await db
    .select()
    .from(comments)
    .where(eq(comments.applicationId, id))
    .orderBy(asc(comments.createdAt));

  res.json({ ...updated, comments: applicationComments });
});

router.delete("/applications/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const [deleted] = await db
    .delete(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.json({ success: true });
});

router.post("/applications/:id/comments", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const { text } = req.body;

  if (!text) {
    res.status(400).json({ error: "Missing required field: text" });
    return;
  }

  const [application] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [created] = await db
    .insert(comments)
    .values({ applicationId: id, userId, text })
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
