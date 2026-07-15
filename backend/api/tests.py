from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from api.services.ai_service import (
    _dedupe_skills,
    _fallback_extract_skills,
    _normalize_skill,
    compare_skills,
)


class SkillNormalizationTests(SimpleTestCase):
    def test_normalizes_aliases(self):
        self.assertEqual(_normalize_skill("js"), "JavaScript")
        self.assertEqual(_normalize_skill("NextJS"), "Next.js")
        self.assertEqual(_normalize_skill("scikit learn"), "Scikit-Learn")

    def test_dedupes_case_insensitive(self):
        skills = _dedupe_skills(["React", "react", "REACT", "TypeScript"])
        self.assertEqual(skills, ["React", "TypeScript"])


class CompareSkillsTests(SimpleTestCase):
    def test_assignment_example(self):
        resume = ["React", "JavaScript", "TypeScript", "Redux", "HTML", "CSS"]
        jd = ["React", "TypeScript", "Redux", "AWS", "Docker"]
        result = compare_skills(resume, jd)

        self.assertEqual(sorted(result["matched_skills"]), ["React", "Redux", "TypeScript"])
        self.assertEqual(sorted(result["missing_skills"]), ["AWS", "Docker"])
        self.assertEqual(result["match_percentage"], 60)
        self.assertIn("JavaScript", result["extra_skills"])

    def test_empty_jd_returns_zero_percent(self):
        result = compare_skills(["Python"], [])
        self.assertEqual(result["match_percentage"], 0)


class FallbackExtractionTests(SimpleTestCase):
    def test_extracts_jd_stack_skills(self):
        text = "Django Python TensorFlow PyTorch Docker PostgreSQL Next.js Angular Git"
        skills = _fallback_extract_skills(text)
        for expected in ["Django", "Python", "TensorFlow", "PyTorch", "Docker", "PostgreSQL", "Next.js", "Angular", "Git"]:
            self.assertIn(expected, skills)


@override_settings(GEMINI_API_KEY="")
class APIEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {
            "resume": "React\nJavaScript\nTypeScript\nRedux\nHTML\nCSS",
            "job_description": "React\nTypeScript\nRedux\nAWS\nDocker",
        }

    def test_health_endpoint(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "ok")

    def test_skill_gap_endpoint(self):
        response = self.client.post("/api/skill-gap/", self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["match_percentage"], 60)
        self.assertIn("matched_skills", data)
        self.assertIn("extra_skills", data)

    def test_fit_verdict_endpoint(self):
        response = self.client.post("/api/fit-verdict/", self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn(data["verdict"], ["Qualified", "Almost There", "Not Yet"])
        self.assertEqual(len(data["reasons"]), 3)

    def test_analyze_all_endpoint(self):
        response = self.client.post("/api/analyze/", self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("skill_gap", data)
        self.assertIn("fit_verdict", data)
        self.assertEqual(data["skill_gap"]["match_percentage"], 60)

    def test_validation_rejects_short_input(self):
        response = self.client.post("/api/skill-gap/", {"resume": "hi", "job_description": "hello"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_validation_rejects_missing_fields(self):
        response = self.client.post("/api/skill-gap/", {"resume": "valid resume text here"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
