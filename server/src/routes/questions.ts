import { Router } from "express";
import { eq, and, ilike, desc, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { interviews, applications } from "../db/schema";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

router.get("/", async (req, res) => {
  const userId = getUserId(req);
  const { type, company, search, status } = req.query;

  const conditions = [
    eq(applications.userId, userId),
    isNotNull(interviews.question),
  ];

  if (typeof type === "string" && type) {
    conditions.push(eq(interviews.type, type));
  }

  if (typeof company === "string" && company) {
    conditions.push(ilike(applications.company, `%${company}%`));
  }

  if (typeof search === "string" && search) {
    conditions.push(ilike(interviews.question, `%${search}%`));
  }

  if (typeof status === "string" && status) {
    conditions.push(eq(interviews.status, status));
  }

  const results = await db
    .select({
      interviewId: interviews.id,
      type: interviews.type,
      status: interviews.status,
      question: interviews.question,
      company: applications.company,
      role: applications.role,
      applicationId: applications.id,
      createdAt: interviews.createdAt,
    })
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .where(and(...conditions))
    .orderBy(desc(interviews.createdAt));

  res.json({ interviews: results.map((r) => ({ ...r, question: r.question! })) });
});

export default router;
