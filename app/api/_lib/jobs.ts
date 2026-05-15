const EXPERIENCE_MARKER = /^\[EXPERIENCE:([^\]]+)\]\s*/;

export function normalizeJobForClient(job: any) {
  const requirements = typeof job.requirements === "string" ? job.requirements : "";
  const experienceMatch = requirements.match(EXPERIENCE_MARKER);
  return {
    ...job,
    type: job.jobType,
    experience: experienceMatch?.[1] || job.experience || "",
    requirements: requirements.replace(EXPERIENCE_MARKER, "").trim(),
  };
}

export function normalizeReadableText(value: unknown, maxChars = 4000) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function keywordTokens(value: unknown) {
  return normalizeReadableText(value, 6000)
    .toLowerCase()
    .split(/[^a-zа-яөүё0-9+#.]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

export function deterministicMatch(job: any, candidate: any) {
  const jobTokens = new Set(keywordTokens([job?.title, job?.description, job?.requirements, job?.category].filter(Boolean).join(" ")));
  const candidateTokens = new Set(keywordTokens([candidate?.cvText, candidate?.skills, candidate?.description, candidate?.location].filter(Boolean).join(" ")));
  const overlap = [...jobTokens].filter((token) => candidateTokens.has(token));
  const score = Math.max(0, Math.min(95, Math.round((overlap.length / Math.max(jobTokens.size, 1)) * 100)));
  return {
    matchScore: score,
    strengths: overlap.slice(0, 5),
    feedback: overlap.length ? `Matching keywords: ${overlap.slice(0, 5).join(", ")}` : "Not enough matching profile data.",
  };
}
