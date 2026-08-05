import { Router } from "express";
import { eq, and, ilike, desc, isNotNull, ne } from "drizzle-orm";
import { db } from "../db";
import { interviews, applications, userSettings } from "../db/schema";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

router.get("/shared", async (req, res) => {
  const userId = getUserId(req);

  const [settings] = await db
    .select({ shareQuestions: userSettings.shareQuestions })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (!settings?.shareQuestions) {
    res.status(403).json({
      error: "Sharing must be enabled to view shared questions.",
      shareQuestions: false,
    });
    return;
  }

  const { type, company, search } = req.query;

  const conditions = [
    eq(interviews.shared, true),
    isNotNull(interviews.questionTitle),
    ne(applications.userId, userId),
  ];

  if (typeof type === "string" && type) {
    conditions.push(eq(interviews.type, type));
  }

  if (typeof company === "string" && company) {
    conditions.push(ilike(applications.company, `%${company}%`));
  }

  if (typeof search === "string" && search) {
    conditions.push(ilike(interviews.questionTitle, `%${search}%`));
  }

  const results = await db
    .select({
      interviewId: interviews.id,
      type: interviews.type,
      questionTitle: interviews.questionTitle,
      questionDetail: interviews.questionDetail,
      company: applications.company,
      createdAt: interviews.createdAt,
    })
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .where(and(...conditions))
    .orderBy(desc(interviews.createdAt));

  res.json({ interviews: results.map((r) => ({ ...r, questionTitle: r.questionTitle! })) });
});

router.get("/", async (req, res) => {
  const userId = getUserId(req);
  const { type, company, search, status } = req.query;

  const conditions = [
    eq(applications.userId, userId),
    isNotNull(interviews.questionTitle),
  ];

  if (typeof type === "string" && type) {
    conditions.push(eq(interviews.type, type));
  }

  if (typeof company === "string" && company) {
    conditions.push(ilike(applications.company, `%${company}%`));
  }

  if (typeof search === "string" && search) {
    conditions.push(ilike(interviews.questionTitle, `%${search}%`));
  }

  if (typeof status === "string" && status) {
    conditions.push(eq(interviews.status, status));
  }

  const results = await db
    .select({
      interviewId: interviews.id,
      type: interviews.type,
      status: interviews.status,
      questionTitle: interviews.questionTitle,
      questionDetail: interviews.questionDetail,
      company: applications.company,
      role: applications.role,
      applicationId: applications.id,
      createdAt: interviews.createdAt,
    })
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .where(and(...conditions))
    .orderBy(desc(interviews.createdAt));

  res.json({ interviews: results.map((r) => ({ ...r, questionTitle: r.questionTitle! })) });
});

export default router;
