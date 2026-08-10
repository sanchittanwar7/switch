import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { userProfiles, workExperiences, projects, skills } from "../db/schema";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

const VALID_EXPERTISE = ["beginner", "intermediate", "expert"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── Location ───────────────────────────────────────────────────────────────

router.get("/location", async (req, res) => {
  try {
    const userId = getUserId(req);
    const [row] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));

    if (!row) {
      res.json(null);
      return;
    }

    res.json({
      city: row.city,
      country: row.country,
      isRemote: row.isRemote,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch location" });
  }
});

router.put("/location", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { city, country, isRemote } = req.body;

    const values = {
      userId,
      city: city || null,
      country: country || null,
      isRemote: Boolean(isRemote),
      updatedAt: new Date(),
    };

    const [row] = await db
      .insert(userProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: [userProfiles.userId],
        set: values,
      })
      .returning();

    res.json({
      city: row.city,
      country: row.country,
      isRemote: row.isRemote,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update location" });
  }
});

// ─── Work Experiences ───────────────────────────────────────────────────────

router.get("/experiences", async (req, res) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select()
      .from(workExperiences)
      .where(eq(workExperiences.userId, userId))
      .orderBy(desc(workExperiences.startDate));

    res.json(
      rows.map((r) => ({
        id: r.id,
        company: r.company,
        role: r.role,
        startDate: r.startDate,
        endDate: r.endDate,
        skills: r.skills,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch experiences" });
  }
});

router.post("/experiences", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { company, role, startDate, endDate, skills: skillsArr } = req.body;

    if (!company || typeof company !== "string" || !company.trim()) {
      res.status(400).json({ error: "Company is required" });
      return;
    }
    if (!role || typeof role !== "string" || !role.trim()) {
      res.status(400).json({ error: "Role is required" });
      return;
    }
    if (!startDate || typeof startDate !== "string" || !DATE_REGEX.test(startDate)) {
      res.status(400).json({ error: "startDate must be YYYY-MM-DD" });
      return;
    }
    if (endDate !== undefined && endDate !== null && (typeof endDate !== "string" || !DATE_REGEX.test(endDate))) {
      res.status(400).json({ error: "endDate must be YYYY-MM-DD or null" });
      return;
    }

    const [row] = await db
      .insert(workExperiences)
      .values({
        userId,
        company: company.trim(),
        role: role.trim(),
        startDate,
        endDate: endDate || null,
        skills: Array.isArray(skillsArr) ? skillsArr : [],
      })
      .returning();

    res.status(201).json({
      id: row.id,
      company: row.company,
      role: row.role,
      startDate: row.startDate,
      endDate: row.endDate,
      skills: row.skills,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create experience" });
  }
});

router.patch("/experiences/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { company, role, startDate, endDate, skills: skillsArr } = req.body;

    const [existing] = await db
      .select()
      .from(workExperiences)
      .where(and(eq(workExperiences.id, id), eq(workExperiences.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Experience not found" });
      return;
    }

    if (startDate !== undefined && (typeof startDate !== "string" || !DATE_REGEX.test(startDate))) {
      res.status(400).json({ error: "startDate must be YYYY-MM-DD" });
      return;
    }
    if (endDate !== undefined && endDate !== null && (typeof endDate !== "string" || !DATE_REGEX.test(endDate))) {
      res.status(400).json({ error: "endDate must be YYYY-MM-DD or null" });
      return;
    }

    const updated: Record<string, any> = { updatedAt: new Date() };
    if (company !== undefined) updated.company = company.trim();
    if (role !== undefined) updated.role = role.trim();
    if (startDate !== undefined) updated.startDate = startDate;
    if (endDate !== undefined) updated.endDate = endDate;
    if (skillsArr !== undefined) updated.skills = Array.isArray(skillsArr) ? skillsArr : [];

    const [row] = await db
      .update(workExperiences)
      .set(updated)
      .where(eq(workExperiences.id, id))
      .returning();

    res.json({
      id: row.id,
      company: row.company,
      role: row.role,
      startDate: row.startDate,
      endDate: row.endDate,
      skills: row.skills,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update experience" });
  }
});

router.delete("/experiences/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(workExperiences)
      .where(and(eq(workExperiences.id, id), eq(workExperiences.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Experience not found" });
      return;
    }

    await db.delete(workExperiences).where(eq(workExperiences.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete experience" });
  }
});

// ─── Projects ───────────────────────────────────────────────────────────────

router.get("/projects", async (req, res) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId));

    res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        github: r.github,
        url: r.url,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { title, description, github, url } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const [row] = await db
      .insert(projects)
      .values({
        userId,
        title: title.trim(),
        description: description || null,
        github: github || null,
        url: url || null,
      })
      .returning();

    res.status(201).json({
      id: row.id,
      title: row.title,
      description: row.description,
      github: row.github,
      url: row.url,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/projects/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { title, description, github, url } = req.body;

    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const updated: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updated.title = title.trim();
    if (description !== undefined) updated.description = description || null;
    if (github !== undefined) updated.github = github || null;
    if (url !== undefined) updated.url = url || null;

    const [row] = await db
      .update(projects)
      .set(updated)
      .where(eq(projects.id, id))
      .returning();

    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      github: row.github,
      url: row.url,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await db.delete(projects).where(eq(projects.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ─── Skills ─────────────────────────────────────────────────────────────────

router.get("/skills", async (req, res) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select()
      .from(skills)
      .where(eq(skills.userId, userId));

    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        expertise: r.expertise,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch skills" });
  }
});

router.post("/skills", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, expertise } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    if (expertise && !VALID_EXPERTISE.includes(expertise)) {
      res.status(400).json({ error: `Expertise must be one of: ${VALID_EXPERTISE.join(", ")}` });
      return;
    }

    const [row] = await db
      .insert(skills)
      .values({
        userId,
        name: name.trim(),
        expertise: expertise || "beginner",
      })
      .returning();

    res.status(201).json({
      id: row.id,
      name: row.name,
      expertise: row.expertise,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create skill" });
  }
});

router.patch("/skills/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { name, expertise } = req.body;

    const [existing] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.id, id), eq(skills.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    if (expertise && !VALID_EXPERTISE.includes(expertise)) {
      res.status(400).json({ error: `Expertise must be one of: ${VALID_EXPERTISE.join(", ")}` });
      return;
    }

    const updated: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updated.name = name.trim();
    if (expertise !== undefined) updated.expertise = expertise;

    const [row] = await db
      .update(skills)
      .set(updated)
      .where(eq(skills.id, id))
      .returning();

    res.json({
      id: row.id,
      name: row.name,
      expertise: row.expertise,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update skill" });
  }
});

router.delete("/skills/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.id, id), eq(skills.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    await db.delete(skills).where(eq(skills.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete skill" });
  }
});

export default router;
