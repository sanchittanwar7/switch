export type AtsJsonApi = { provider: string; url: string };
export const ATS_PROVIDERS = [
  "Ashby",
  "Greenhouse",
  "Lever",
  "Recruitee",
  "SmartRecruiters",
  "Workday",
] as const;
export type AtsProvider = (typeof ATS_PROVIDERS)[number];

export function getAtsJsonApi(sourceUrl: string, atsProvider?: AtsProvider): AtsJsonApi | null {
  const source = new URL(sourceUrl);
  const host = source.hostname.toLowerCase();
  const pathParts = source.pathname.split("/").filter(Boolean);

  if (atsProvider === "Recruitee") {
    return {
      provider: "Recruitee",
      url: new URL("/api/offers/", source).toString(),
    };
  }

  if ((!atsProvider || atsProvider === "Ashby") && host === "jobs.ashbyhq.com" && pathParts[0]) {
    return {
      provider: "Ashby",
      url: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(pathParts[0])}`,
    };
  }

  if (
    (!atsProvider || atsProvider === "Greenhouse") &&
    host === "boards.greenhouse.io" &&
    pathParts[0]
  ) {
    return {
      provider: "Greenhouse",
      url: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(pathParts[0])}/jobs`,
    };
  }

  if ((!atsProvider || atsProvider === "Lever") && host === "jobs.lever.co" && pathParts[0]) {
    return {
      provider: "Lever",
      url: `https://api.lever.co/v0/postings/${encodeURIComponent(pathParts[0])}?mode=json`,
    };
  }

  if (!atsProvider && host.endsWith(".recruitee.com")) {
    return {
      provider: "Recruitee",
      url: `https://${source.hostname}/api/offers/`,
    };
  }

  if (
    (!atsProvider || atsProvider === "SmartRecruiters") &&
    host === "jobs.smartrecruiters.com" &&
    pathParts[0]
  ) {
    return {
      provider: "SmartRecruiters",
      url: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(pathParts[0])}/postings`,
    };
  }

  if (
    (!atsProvider || atsProvider === "Workday") &&
    host.endsWith(".myworkdayjobs.com") &&
    pathParts[1]
  ) {
    const company = host.split(".")[0];
    return {
      provider: "Workday",
      url: `https://${source.hostname}/wday/cxs/${encodeURIComponent(company)}/${encodeURIComponent(pathParts[1])}/jobs`,
    };
  }

  return null;
}
