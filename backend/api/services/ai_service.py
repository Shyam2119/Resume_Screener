import json
import logging
import re
import time
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

# Tried in order when the primary model is overloaded (503), rate-limited, or not found.
_DEFAULT_FALLBACK_MODELS = (
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
)

_MAX_RETRIES = 3
_RETRY_BASE_DELAY_SEC = 1.0
_DEFAULT_MODEL = "gemini-2.5-flash"

SKILL_ALIASES: dict[str, str] = {
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "py": "Python",
    "python3": "Python",
    "node": "Node.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "react.js": "React",
    "reactjs": "React",
    "next": "Next.js",
    "nextjs": "Next.js",
    "next.js": "Next.js",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "mongo": "MongoDB",
    "k8s": "Kubernetes",
    "tf": "TensorFlow",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "torch": "PyTorch",
    "sklearn": "Scikit-Learn",
    "scikit learn": "Scikit-Learn",
    "scikit-learn": "Scikit-Learn",
    "ml": "Machine Learning",
    "ai": "Machine Learning",
    "aiml": "Machine Learning",
    "docker": "Docker",
    "git": "Git",
    "django": "Django",
    "angular": "Angular",
    "aws": "AWS",
    "gcp": "GCP",
    "azure": "Azure",
}

SKILL_EXTRACTION_PROMPT = """Extract technical skills from the text below.
Return ONLY a JSON array of skill strings (no markdown, no explanation).
Normalize names (e.g. "JS" -> "JavaScript", "Node" -> "Node.js", "PyTorch" -> "PyTorch").
Include frameworks, languages, tools, cloud platforms, databases, and ML/AI libraries.

Text:
{text}"""

COMBINED_ANALYSIS_PROMPT = """You are a technical recruiter screening a candidate.

Resume:
{resume}

Job Description:
{job_description}

Return ONLY valid JSON with this exact structure:
{{
  "resume_skills": ["skill1", "skill2"],
  "jd_skills": ["skill1", "skill2"],
  "verdict": "Qualified" | "Almost There" | "Not Yet",
  "reasons": ["reason 1", "reason 2", "reason 3"]
}}

Rules:
- Extract and normalize technical skills from resume and JD separately
- verdict "Qualified": strong match on required skills and experience
- verdict "Almost There": good overlap but missing some key requirements
- verdict "Not Yet": significant gaps in required skills or experience
- Provide exactly 3 concise, specific reasons"""

VERDICT_PROMPT = """You are a technical recruiter. Compare the candidate resume with the job description.

Resume:
{resume}

Job Description:
{job_description}

Return ONLY valid JSON with this exact structure:
{{
  "verdict": "Qualified" | "Almost There" | "Not Yet",
  "reasons": ["reason 1", "reason 2", "reason 3"]
}}

Rules:
- verdict "Qualified": strong match on required skills and experience
- verdict "Almost There": good overlap but missing some key requirements
- verdict "Not Yet": significant gaps in required skills or experience
- Provide exactly 3 concise, specific reasons referencing actual skills from the texts"""


class AIServiceError(Exception):
    """Raised when the AI provider fails and no fallback applies."""

    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


def is_ai_configured() -> bool:
    key = (settings.GEMINI_API_KEY or "").strip()
    if not key:
        return False
    placeholders = {
        "your-gemini-api-key-here",
        "changeme",
        "replace-me",
    }
    return key.lower() not in placeholders


def _get_client():
    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key:
        return None
    from google import genai
    return genai.Client(api_key=api_key)


def _is_rate_limit(exc: Exception) -> bool:
    """True only for genuine quota/rate-limit errors (HTTP 429 / RESOURCE_EXHAUSTED)."""
    message = str(exc).lower()
    # Must be specific — avoid false positives from words like "generateContent"
    return (
        "429" in message
        or "resource_exhausted" in message
        or "quota_exceeded" in message
        or "quota exceeded" in message
        or "too many requests" in message
        or "retry_delay" in message
    )


def _is_transient(exc: Exception) -> bool:
    """True for temporary overload / capacity errors that often succeed on retry."""
    message = str(exc).lower()
    return (
        "503" in message
        or "unavailable" in message
        or "high demand" in message
        or "overloaded" in message
        or "try again later" in message
        or "temporarily" in message
    )


def _is_model_not_found(exc: Exception) -> bool:
    message = str(exc).lower()
    return "404" in message or "not_found" in message or "not found" in message


def _candidate_models() -> list[str]:
    primary = (getattr(settings, "GEMINI_MODEL", "") or _DEFAULT_MODEL).strip()
    configured = getattr(settings, "GEMINI_FALLBACK_MODELS", None)
    if configured:
        fallbacks = [m.strip() for m in configured if str(m).strip()]
    else:
        fallbacks = list(_DEFAULT_FALLBACK_MODELS)

    models: list[str] = []
    for model in [primary, *fallbacks]:
        if model and model not in models:
            models.append(model)
    return models


def _generate(prompt: str, *, temperature: float = 0.2) -> str:
    client = _get_client()
    if not client:
        raise AIServiceError("Gemini API key is not configured.", status_code=503)

    from google.genai import types

    config = types.GenerateContentConfig(
        temperature=temperature,
        response_mime_type="application/json",
    )
    models = _candidate_models()
    last_exc: Exception | None = None
    saw_rate_limit = False

    for model_index, model in enumerate(models):
        for attempt in range(_MAX_RETRIES):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                if model != models[0]:
                    logger.info("Gemini succeeded with fallback model %s", model)
                return (response.text or "").strip()
            except Exception as exc:
                last_exc = exc
                if _is_rate_limit(exc):
                    saw_rate_limit = True
                    if model_index < len(models) - 1:
                        logger.warning(
                            "Gemini rate/quota limit on %s; trying next model",
                            model,
                        )
                        break
                    logger.warning("Gemini rate limit exceeded on all candidate models")
                    raise AIServiceError(
                        "AI rate limit exceeded. Please try again shortly.",
                        status_code=429,
                    ) from exc
                if _is_model_not_found(exc):
                    logger.warning("Gemini model not found: %s; trying next", model)
                    break
                if _is_transient(exc) and attempt < _MAX_RETRIES - 1:
                    delay = _RETRY_BASE_DELAY_SEC * (2**attempt)
                    logger.warning(
                        "Gemini %s overloaded (attempt %s/%s); retrying in %.1fs",
                        model,
                        attempt + 1,
                        _MAX_RETRIES,
                        delay,
                    )
                    time.sleep(delay)
                    continue
                if _is_transient(exc) and model_index < len(models) - 1:
                    logger.warning(
                        "Gemini %s still unavailable; falling back to next model",
                        model,
                    )
                    break
                logger.exception("Gemini API error (model=%s)", model)
                raise AIServiceError(
                    "AI service is temporarily unavailable.",
                    status_code=503,
                ) from exc

    if last_exc and _is_model_not_found(last_exc) and not saw_rate_limit:
        raise AIServiceError(
            f"Model '{models[0]}' not found. Check GEMINI_MODEL env var.",
            status_code=404,
        ) from last_exc

    if saw_rate_limit:
        raise AIServiceError(
            "AI rate limit exceeded. Please try again shortly.",
            status_code=429,
        ) from last_exc

    logger.error("Gemini API error after retries", exc_info=last_exc)
    raise AIServiceError(
        "AI service is temporarily unavailable.",
        status_code=503,
    ) from last_exc


def _normalize_skill(skill: str) -> str:
    cleaned = skill.strip()
    if not cleaned:
        return cleaned
    alias = SKILL_ALIASES.get(cleaned.lower())
    return alias if alias else cleaned


def _dedupe_skills(skills: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for skill in skills:
        normalized = _normalize_skill(skill)
        key = normalized.lower()
        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)
    return result


def _parse_json_array(content: str) -> list[str]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    data = json.loads(content)
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    return _dedupe_skills([str(item).strip() for item in data if str(item).strip()])


def _parse_json_object(content: str) -> dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    return data


def _normalize_verdict(data: dict[str, Any]) -> dict[str, Any]:
    verdict = data.get("verdict", "Not Yet")
    reasons = data.get("reasons", [])
    if verdict not in ("Qualified", "Almost There", "Not Yet"):
        verdict = "Not Yet"
    if not isinstance(reasons, list) or len(reasons) < 3:
        reasons = (reasons if isinstance(reasons, list) else []) + [
            "Additional review recommended."
        ] * 3
        reasons = reasons[:3]
    return {"verdict": verdict, "reasons": reasons}


def _fallback_extract_skills(text: str) -> list[str]:
    """Keyword-based fallback when Gemini is unavailable."""
    known_skills = [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "Ruby", "PHP",
        "React", "Angular", "Vue", "Next.js", "Redux", "HTML", "CSS", "Tailwind",
        "Django", "Flask", "FastAPI", "Node.js", "Express", "Spring Boot",
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite",
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Git", "CI/CD",
        "TensorFlow", "PyTorch", "Scikit-Learn", "Machine Learning", "Deep Learning",
        "REST API", "GraphQL", "Microservices", "Agile", "Scrum",
    ]
    known_skills.sort(key=len, reverse=True)
    text_lower = text.lower()
    found: list[str] = []
    consumed: list[tuple[int, int]] = []

    for skill in known_skills:
        pattern = re.compile(r"(?<![a-z0-9])" + re.escape(skill.lower()) + r"(?![a-z0-9])")
        for match in pattern.finditer(text_lower):
            start, end = match.span()
            if not any(start < c_end and end > c_start for c_start, c_end in consumed):
                found.append(skill)
                consumed.append((start, end))
                break

    return _dedupe_skills(found)


def extract_skills(text: str, *, allow_fallback: bool = True) -> list[str]:
    if not is_ai_configured():
        if allow_fallback:
            logger.warning("GEMINI_API_KEY not set; using fallback skill extraction")
            return _fallback_extract_skills(text)
        raise AIServiceError("Gemini API key is not configured.", status_code=503)

    try:
        content = _generate(
            SKILL_EXTRACTION_PROMPT.format(text=text),
            temperature=0.1,
        )
        return _parse_json_array(content)
    except (json.JSONDecodeError, ValueError):
        logger.exception("Failed to parse AI skill extraction response")
        if allow_fallback:
            return _fallback_extract_skills(text)
        raise AIServiceError("Failed to parse AI skill extraction response.", status_code=502)
    except AIServiceError:
        if allow_fallback:
            logger.warning("Gemini unavailable; using fallback skill extraction")
            return _fallback_extract_skills(text)
        raise


def compare_skills(resume_skills: list[str], jd_skills: list[str]) -> dict[str, Any]:
    resume_normalized = _dedupe_skills(resume_skills)
    jd_normalized = _dedupe_skills(jd_skills)

    resume_set = {s.lower() for s in resume_normalized}
    jd_map = {s.lower(): s for s in jd_normalized}

    matched = []
    missing = []
    for skill_lower, skill_original in jd_map.items():
        if skill_lower in resume_set:
            resume_match = next(
                (s for s in resume_normalized if s.lower() == skill_lower),
                skill_original,
            )
            matched.append(resume_match)
        else:
            missing.append(skill_original)

    extra = [s for s in resume_normalized if s.lower() not in jd_map]

    total = len(jd_normalized)
    percentage = round((len(matched) / total) * 100) if total > 0 else 0

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "extra_skills": extra,
        "match_percentage": percentage,
        "resume_skills": resume_normalized,
        "jd_skills": jd_normalized,
    }


def analyze_skill_gap(resume: str, job_description: str) -> dict[str, Any]:
    if not is_ai_configured():
        result = compare_skills(
            _fallback_extract_skills(resume),
            _fallback_extract_skills(job_description),
        )
        result["ai_powered"] = False
        return result

    try:
        # One Gemini call for both texts to reduce free-tier usage
        content = _generate(
            COMBINED_ANALYSIS_PROMPT.format(resume=resume, job_description=job_description),
            temperature=0.1,
        )
        data = _parse_json_object(content)
        resume_skills = _dedupe_skills(
            [str(s) for s in data.get("resume_skills", []) if str(s).strip()]
        ) or _fallback_extract_skills(resume)
        jd_skills = _dedupe_skills(
            [str(s) for s in data.get("jd_skills", []) if str(s).strip()]
        ) or _fallback_extract_skills(job_description)
        result = compare_skills(resume_skills, jd_skills)
        result["ai_powered"] = True
        return result
    except Exception:
        logger.warning("Skill-gap Gemini call failed; using keyword fallback", exc_info=True)
        result = compare_skills(
            _fallback_extract_skills(resume),
            _fallback_extract_skills(job_description),
        )
        result["ai_powered"] = False
        return result


def generate_verdict(resume: str, job_description: str) -> dict[str, Any]:
    if not is_ai_configured():
        logger.warning("GEMINI_API_KEY not set; using rule-based verdict fallback")
        result = _fallback_verdict(resume, job_description)
        result["ai_powered"] = False
        return result

    try:
        content = _generate(
            VERDICT_PROMPT.format(resume=resume, job_description=job_description),
            temperature=0.3,
        )
        data = _normalize_verdict(_parse_json_object(content))
        data["ai_powered"] = True
        return data
    except (json.JSONDecodeError, ValueError):
        logger.exception("Failed to parse AI verdict response")
        result = _fallback_verdict(resume, job_description)
        result["ai_powered"] = False
        return result
    except AIServiceError:
        # Always fall back on rate limit / API errors — never hard-fail the UI
        logger.warning("Gemini unavailable for verdict; using rule-based fallback")
        result = _fallback_verdict(resume, job_description)
        result["ai_powered"] = False
        return result


def analyze_all(resume: str, job_description: str) -> dict[str, Any]:
    """Run both features with a single Gemini call when possible (saves free-tier quota)."""
    if is_ai_configured():
        try:
            content = _generate(
                COMBINED_ANALYSIS_PROMPT.format(resume=resume, job_description=job_description),
                temperature=0.2,
            )
            data = _parse_json_object(content)
            resume_skills = _dedupe_skills(
                [str(s) for s in data.get("resume_skills", []) if str(s).strip()]
            )
            jd_skills = _dedupe_skills(
                [str(s) for s in data.get("jd_skills", []) if str(s).strip()]
            )
            if not resume_skills:
                resume_skills = _fallback_extract_skills(resume)
            if not jd_skills:
                jd_skills = _fallback_extract_skills(job_description)

            skill_gap = compare_skills(resume_skills, jd_skills)
            skill_gap["ai_powered"] = True
            fit_verdict = _normalize_verdict(data)
            fit_verdict["ai_powered"] = True
            return {"skill_gap": skill_gap, "fit_verdict": fit_verdict}
        except Exception:
            logger.warning("Combined Gemini analysis failed; using fallbacks", exc_info=True)

    # Local fallback — no hard error on rate limits
    skill_gap = compare_skills(
        _fallback_extract_skills(resume),
        _fallback_extract_skills(job_description),
    )
    skill_gap["ai_powered"] = False
    fit_verdict = _fallback_verdict(resume, job_description)
    fit_verdict["ai_powered"] = False
    return {"skill_gap": skill_gap, "fit_verdict": fit_verdict}


def _fallback_verdict(resume: str, job_description: str) -> dict[str, Any]:
    comparison = compare_skills(
        _fallback_extract_skills(resume),
        _fallback_extract_skills(job_description),
    )
    pct = comparison["match_percentage"]
    matched = comparison["matched_skills"]
    missing = comparison["missing_skills"]

    if pct >= 75:
        verdict = "Qualified"
    elif pct >= 45:
        verdict = "Almost There"
    else:
        verdict = "Not Yet"

    reasons = []
    if matched:
        reasons.append(f"Strong overlap in: {', '.join(matched[:5])}.")
    else:
        reasons.append("Limited skill overlap with the job requirements.")
    if missing:
        reasons.append(f"Missing key skills: {', '.join(missing[:5])}.")
    else:
        reasons.append("Covers all identified required skills.")
    reasons.append(f"Overall skill match is approximately {pct}%.")

    return {"verdict": verdict, "reasons": reasons[:3]}
