export interface SkillGapResult {
  matched_skills: string[];
  missing_skills: string[];
  extra_skills: string[];
  match_percentage: number;
  resume_skills: string[];
  jd_skills: string[];
  ai_powered?: boolean;
}

export interface FitVerdictResult {
  verdict: "Qualified" | "Almost There" | "Not Yet";
  reasons: string[];
  ai_powered?: boolean;
}

export interface AnalyzeAllResult {
  skill_gap: SkillGapResult;
  fit_verdict: FitVerdictResult;
}

export interface ParseFileResult {
  text: string;
  filename: string;
  chars: number;
}

export type Tab = "skill-gap" | "fit-verdict";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function parseApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;

  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;

  const messages: string[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      messages.push(`${field}: ${value.join(", ")}`);
    } else if (typeof value === "string") {
      messages.push(`${field}: ${value}`);
    }
  }
  return messages.length > 0 ? messages.join(" · ") : fallback;
}

async function postJson<T>(path: string, payload: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Cannot reach the backend. Make sure Django is running: python manage.py runserver"
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, `Request failed (${res.status})`));
  }
  return res.json();
}

export async function analyzeAll(
  resume: string,
  jobDescription: string
): Promise<AnalyzeAllResult> {
  return postJson("/api/analyze/", {
    resume,
    job_description: jobDescription,
  });
}

export async function analyzeSkillGap(
  resume: string,
  jobDescription: string
): Promise<SkillGapResult> {
  return postJson("/api/skill-gap/", {
    resume,
    job_description: jobDescription,
  });
}

export async function analyzeFitVerdict(
  resume: string,
  jobDescription: string
): Promise<FitVerdictResult> {
  return postJson("/api/fit-verdict/", {
    resume,
    job_description: jobDescription,
  });
}

export async function parseFile(file: File): Promise<ParseFileResult> {
  let res: Response;
  const formData = new FormData();
  formData.append("file", file);

  try {
    res = await fetch(`${API_BASE}/api/parse-file/`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "Cannot reach the backend. Make sure Django is running: python manage.py runserver"
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, `File parse failed (${res.status})`));
  }
  return res.json();
}
