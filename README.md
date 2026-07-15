# Resume Screener — AI-Powered Skills Analysis

A full-stack AI application that compares a candidate's resume against a job description and delivers instant, structured feedback in two complementary views.

**🔗 Live Demo:** [resume-screener-drab.vercel.app](https://resume-screener-drab.vercel.app)

---

## Features

| Feature | Description |
|---|---|
| 🎯 **Skill Gap Checker** | Extracts skills from both inputs, shows matched / missing / bonus skills with an animated donut chart and match percentage |
| 🏆 **Fit Verdict** | AI hiring verdict — *Qualified / Almost There / Not Yet* — backed by three specific, evidence-based reasons |
| 📎 **PDF / DOCX Upload** | Drag-and-drop or click-to-browse file parsing for resume and job description |
| 🔗 **Share Results** | One-click copy of a shareable URL (results base64-encoded in the hash — no server storage needed) |
| 📄 **Export as PDF** | Browser print dialog renders a clean, print-optimised report |
| ☀️ **Dark / Light Mode** | Toggle persisted to `localStorage` |
| ⚡ **Graceful Fallback** | If Gemini is unavailable or rate-limited, keyword extraction and rule-based verdict keep the app fully functional — clearly indicated by a badge in the UI |
| 🔄 **Stale Detection** | Banner prompts re-analysis when inputs change after a result is shown |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Vanilla CSS |
| **Backend** | Django 5.2, Django REST Framework |
| **AI** | Google Gemini API via `google-genai` SDK |
| **Primary model** | `gemini-3.5-flash` |
| **Fallback models** | `gemini-3.1-flash-lite` → keyword mode |
| **File Parsing** | PyPDF2, python-docx |
| **Containerisation** | Docker, Docker Compose |
| **Hosting** | Vercel (frontend) + Render (backend) |

---

## Architecture

```
┌──────────────────────┐      REST API      ┌──────────────────────┐
│   Next.js Frontend   │ ─────────────────► │   Django Backend     │
│   Vercel             │                    │   Render             │
└──────────────────────┘                    └──────────┬───────────┘
                                                       │
                                                       ▼
                                            ┌──────────────────────┐
                                            │   Google Gemini API  │
                                            │   (skill extract +   │
                                            │    fit verdict)      │
                                            └──────────────────────┘
```

**Single-request design:** The frontend calls `/api/analyze/` once per click, which runs skill-gap extraction and fit-verdict generation in a single Gemini prompt. This halves free-tier quota usage compared to two separate calls.

**Model rotation:** `ai_service.py` tries models in priority order (`GEMINI_MODEL` → `GEMINI_FALLBACK_MODELS`) and downgrades to keyword mode only when all fail.

---

## Prerequisites

- Python 3.12+
- Node.js 20+
- Gemini API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- (Optional) Docker & Docker Compose

---

## Quick Start (Local)

### 1. Clone & configure

```bash
git clone https://github.com/Shyam2119/Resume_Screener.git
cd Resume_Screener
cp .env.example .env
# Open .env and set GEMINI_API_KEY
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend available at **http://localhost:8000**

### 3. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend available at **http://localhost:3000**

---

## Docker

```bash
cp .env.example .env
# Set GEMINI_API_KEY in .env

docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Health check | http://localhost:8000/api/health/ |

---

## Deployment

### Backend — Render

1. Create a new **Web Service** on [render.com](https://render.com), pointing to the `backend/` directory.
2. Set **Dockerfile path** to `backend/Dockerfile`.
3. Add the following environment variables:

| Variable | Example Value | Notes |
|---|---|---|
| `GEMINI_API_KEY` | `AIzaSy...` | From AI Studio |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Primary model |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.1-flash-lite` | Comma-separated fallbacks |
| `DJANGO_SECRET_KEY` | *(random 50-char string)* | Keep secret |
| `ALLOWED_HOSTS` | `your-service.onrender.com` | |
| `CORS_ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | |

### Frontend — Vercel

1. Import the repository on [vercel.com](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Add environment variable:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-service.onrender.com` |

---

## Environment Variables

### Backend (`.env`)

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite
DJANGO_SECRET_KEY=change-me-in-production
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## API Reference

### `POST /api/analyze/`

Runs skill-gap and fit-verdict in a single request (recommended — conserves API quota).

**Request:**
```json
{
  "resume": "Shyam Pattipu — Full Stack Developer\nSkills: React, TypeScript ...",
  "job_description": "Full Stack Developer\nRequired: React, TypeScript, AWS ..."
}
```

**Response:**
```json
{
  "skill_gap": {
    "matched_skills": ["React", "TypeScript", "Redux"],
    "missing_skills": ["AWS", "Docker"],
    "extra_skills": ["HTML", "CSS", "Node.js"],
    "match_percentage": 60,
    "resume_skills": ["React", "TypeScript", "Redux", "HTML", "CSS", "Node.js"],
    "jd_skills": ["React", "TypeScript", "Redux", "AWS", "Docker"],
    "ai_powered": true
  },
  "fit_verdict": {
    "verdict": "Almost There",
    "reasons": [
      "Strong match on React, TypeScript, and Redux.",
      "Missing cloud and containerisation experience (AWS, Docker).",
      "Covers all identified required core skills."
    ],
    "ai_powered": true
  }
}
```

### `POST /api/parse-file/`

Accepts `multipart/form-data` with a `file` field (PDF or DOCX, max 5 MB).

**Response:**
```json
{
  "text": "Extracted resume text...",
  "filename": "resume.pdf",
  "chars": 1842
}
```

### `GET /api/health/`

```json
{
  "status": "ok",
  "ai_configured": true,
  "model": "gemini-3.5-flash"
}
```

---

## Project Structure

```
Resume_Screener/
├── backend/
│   ├── api/
│   │   ├── services/
│   │   │   ├── ai_service.py      # Gemini integration, fallback logic, model rotation
│   │   │   └── file_parser.py     # PDF & DOCX text extraction
│   │   ├── views.py               # REST endpoints
│   │   ├── serializers.py         # Input validation
│   │   └── urls.py
│   ├── resume_screener/
│   │   └── settings.py            # Django + Gemini model config
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages & global CSS
│   │   └── components/
│   │       ├── InputPanel.tsx         # Text + file upload inputs
│   │       ├── SkillGapResult.tsx     # Donut chart, skill tags, share/export
│   │       ├── FitVerdictResult.tsx   # Verdict badge & reasons
│   │       ├── LoadingPanel.tsx       # Multi-step animated loader
│   │       └── ThemeToggle.tsx        # Dark/light mode switch
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Assumptions & Design Decisions

| Decision | Rationale |
|---|---|
| **Single `/api/analyze/` call** | Halves Gemini API quota usage — skill-gap and verdict extracted in one prompt |
| **Model rotation fallback** | Tries models in order; falls to keyword mode only when all fail — maximises AI uptime on free tier |
| **`google-genai` SDK** | Google's official, actively maintained SDK; replaces the deprecated `google-generativeai` package |
| **Gemini over self-hosted ML** | Better NLP for unstructured resume text with zero infrastructure |
| **SQLite over PostgreSQL** | Zero-config for reviewers; trivial to swap via `DATABASE_URL` in production |
| **PyPDF2/python-docx over OCR** | Handles digital PDFs cleanly; Tesseract would add Docker image size for marginal gain |
| **Single-page tabs vs separate routes** | Shared input state avoids re-uploading files when switching between Skill Gap and Fit Verdict |
| **Share via URL hash** | Stateless — no database required; works offline; reviewer opens results without running the backend |
| **`window.print()` for PDF export** | Zero client-side dependencies; clean print layout via any browser |

---

## Author

**Shyam Pattipu**

## License

MIT


