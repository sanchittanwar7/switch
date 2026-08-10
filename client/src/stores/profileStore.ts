import { create } from "zustand";
import {
  getLocation,
  updateLocation as apiUpdateLocation,
  getExperiences,
  createExperience,
  updateExperience as apiUpdateExperience,
  deleteExperience,
  getProjects,
  createProject,
  updateProject as apiUpdateProject,
  deleteProject,
  getSkills,
  createSkill,
  updateSkill as apiUpdateSkill,
  deleteSkill,
  type ProfileLocation,
  type ProfileWorkExperience,
  type ProfileProject,
  type ProfileSkill,
} from "../lib/api";

export type Location = ProfileLocation;
export type WorkExperience = ProfileWorkExperience;
export type Project = ProfileProject;
export type Skill = ProfileSkill;

interface ProfileState {
  location: Location | null;
  experiences: WorkExperience[];
  projects: Project[];
  skills: Skill[];
  loading: boolean;
  error: string | null;
  formLoading: boolean;

  loadProfile: () => Promise<void>;

  updateLocation: (data: Partial<Location>) => Promise<void>;

  addExperience: (data: Omit<WorkExperience, "id">) => Promise<void>;
  updateExperience: (id: string, data: Partial<Omit<WorkExperience, "id">>) => Promise<void>;
  deleteExperience: (id: string) => Promise<void>;

  addProject: (data: Omit<Project, "id">) => Promise<void>;
  updateProject: (id: string, data: Partial<Omit<Project, "id">>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  addSkill: (data: Omit<Skill, "id">) => Promise<void>;
  updateSkill: (id: string, data: Partial<Omit<Skill, "id">>) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;

  clearError: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  location: null,
  experiences: [],
  projects: [],
  skills: [],
  loading: false,
  error: null,
  formLoading: false,

  loadProfile: async () => {
    set({ loading: true, error: null });
    try {
      const [locationData, experiencesData, projectsData, skillsData] = await Promise.all([
        getLocation().catch(() => null),
        getExperiences().catch(() => [] as WorkExperience[]),
        getProjects().catch(() => [] as Project[]),
        getSkills().catch(() => [] as Skill[]),
      ]);
      set({
        location: locationData,
        experiences: experiencesData,
        projects: projectsData,
        skills: skillsData,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load profile",
      });
    }
  },

  updateLocation: async (data) => {
    set({ formLoading: true, error: null });
    try {
      const updated = await apiUpdateLocation(data);
      set({ location: updated, formLoading: false });
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to update location",
      });
      throw err;
    }
  },

  addExperience: async (data) => {
    set({ formLoading: true, error: null });
    try {
      const created = await createExperience(data);
      set((state) => ({
        experiences: [created, ...state.experiences],
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to add experience",
      });
      throw err;
    }
  },

  updateExperience: async (id, data) => {
    set({ formLoading: true, error: null });
    try {
      const updated = await apiUpdateExperience(id, data);
      set((state) => ({
        experiences: state.experiences.map((e) => (e.id === id ? updated : e)),
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to update experience",
      });
      throw err;
    }
  },

  deleteExperience: async (id) => {
    set({ formLoading: true, error: null });
    try {
      await deleteExperience(id);
      set((state) => ({
        experiences: state.experiences.filter((e) => e.id !== id),
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to delete experience",
      });
      throw err;
    }
  },

  addProject: async (data) => {
    set({ formLoading: true, error: null });
    try {
      const created = await createProject(data);
      set((state) => ({
        projects: [...state.projects, created],
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to add project",
      });
      throw err;
    }
  },

  updateProject: async (id, data) => {
    set({ formLoading: true, error: null });
    try {
      const updated = await apiUpdateProject(id, data);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updated : p)),
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to update project",
      });
      throw err;
    }
  },

  deleteProject: async (id) => {
    set({ formLoading: true, error: null });
    try {
      await deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to delete project",
      });
      throw err;
    }
  },

  addSkill: async (data) => {
    set({ formLoading: true, error: null });
    try {
      const created = await createSkill(data);
      set((state) => ({
        skills: [...state.skills, created],
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to add skill",
      });
      throw err;
    }
  },

  updateSkill: async (id, data) => {
    set({ formLoading: true, error: null });
    try {
      const updated = await apiUpdateSkill(id, data);
      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? updated : s)),
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to update skill",
      });
      throw err;
    }
  },

  deleteSkill: async (id) => {
    set({ formLoading: true, error: null });
    try {
      await deleteSkill(id);
      set((state) => ({
        skills: state.skills.filter((s) => s.id !== id),
        formLoading: false,
      }));
    } catch (err) {
      set({
        formLoading: false,
        error: err instanceof Error ? err.message : "Failed to delete skill",
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
