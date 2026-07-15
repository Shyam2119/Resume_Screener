# Resume Screener

A single full-stack application with two AI-powered features for comparing a candidate's resume against a job description:

1. **Skill Gap Checker** — extracts skills from both inputs, shows matched/missing skills, a visual donut chart, and match percentage
2. **Fit Verdict** — provides a hiring verdict (Qualified / Almost There / Not Yet) with three AI-generated supporting reasons

Built for the Techotlist Connects LLP Full Stack Developer take-home assignment.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | Django 5, Django REST Framework |
| AI | Google Gemini API (gemini-2.0-flash) |
| File Parsing | PyPDF2, python-docx |
| Containerization | Docker, Docker Compose |

## Features

- 📎 **PDF / DOCX Upload** — drag-and-drop or click-to-browse for both resume and job description fields; text auto-replaces any pre-filled content
- 📊 **Visual Donut Chart** — animated SVG breakdown of matched vs missing skills
- 🔗 **Share Results** — one-click copy of a shareable link (results encoded in URL hash)
- 📄 **Export as PDF** — browser print dialog renders a clean report
- ☀️ **Dark / Light Mode** — toggle in the top-right corner, persisted to localStorage
- ⚡ **Keyword Fallback** — app works even without a Gemini API key (rule-based extraction)
- ✅ **Stale Detection** — banner appears when inputs change after an analysis

## Architecture

```
┌─────────────────┐     REST API      ┌─────────────────┐
│  Next.js UI     │ ────────────────► │  Django Backend │
│  (Port 3000)    │                   │  (Port 8000)    │
└─────────────────┘                   └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  Gemini API     │
                                      │  (skill extract │
                                      │   & verdict)    │
                                      └─────────────────┘
```

## Prerequisites

- Python 3.12+
- Node.js 20+
- Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- (Optional) Docker & Docker Compose

## Quick Start (Local)

### 1. Clone and configure environment

```bash
git clone <your-repo-url>
cd Resume_Screener
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs at **http://localhost:8000**

### 3. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

## Docker

```bash
cp .env.example .env
# Set GEMINI_API_KEY in .env

docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health check: http://localhost:8000/api/health/

## API Endpoints

### POST `/api/skill-gap/`

**Request:**
```json
{
  "resume": "React, JavaScript, TypeScript, Redux...",
  "job_description": "React, TypeScript, Redux, AWS, Docker..."
}
```

**Response:**
```json
{
  "matched_skills": ["React", "TypeScript", "Redux"],
  "missing_skills": ["AWS", "Docker"],
  "extra_skills": ["JavaScript", "HTML", "CSS"],
  "match_percentage": 60,
  "resume_skills": ["React", "JavaScript", "TypeScript", "Redux", "HTML", "CSS"],
  "jd_skills": ["React", "TypeScript", "Redux", "AWS", "Docker"],
  "ai_powered": true
}
```

### POST `/api/analyze/`

Runs both skill-gap and fit-verdict in a single request (used by the frontend to reduce API quota usage).

**Response:**
```json
{
  "skill_gap": { "...": "..." },
  "fit_verdict": { "...": "..." }
}
```

### POST `/api/parse-file/`

Accepts a `multipart/form-data` upload with a `file` field (PDF or DOCX, max 5 MB). Returns extracted plain text.

**Response:**
```json
{
  "text": "Extracted resume text...",
  "filename": "resume.pdf",
  "chars": 1842
}
```

### POST `/api/fit-verdict/`

**Request:** Same as skill-gap.

**Response:**
```json
{
  "verdict": "Almost There",
  "reasons": [
    "Strong experience in React, TypeScript, and Redux.",
    "Good match for the required frontend technologies.",
    "Missing experience with AWS and Docker."
  ],
  "ai_powered": true
}
```

### GET `/api/health/`

Returns service status and AI configuration.

**Response:**
```json
{
  "status": "ok",
  "ai_configured": true,
  "model": "gemini-2.0-flash"
}
```

## Assumptions

- Users can paste plain text **or** upload a PDF/DOCX (up to 5 MB) for resume and job description
- Skill extraction and verdict generation are powered by Google Gemini; a keyword-based fallback runs if `GEMINI_API_KEY` is not set (useful for local demo without API costs)
- Match percentage is calculated as `(matched JD skills / total JD skills) × 100`
- `extra_skills` shows resume skills not required by the JD (bonus strengths)
- One "Analyze" action runs both features via `/api/analyze/` to conserve free-tier quota
- Verdict thresholds in fallback mode: ≥75% Qualified, ≥45% Almost There, else Not Yet
- Share link encodes results as base64 in the URL hash (no server-side storage needed)

## Trade-offs

| Decision | Rationale |
|----------|-----------|
| Gemini over self-hosted ML | Faster to implement, better NLP for unstructured text; aligns with assignment's AI integration requirement |
| SQLite over PostgreSQL | Zero-config for reviewers; easy to swap to PostgreSQL via Django settings for production |
| PDF/DOCX text extraction over OCR | PyPDF2/python-docx handle digital PDFs well; OCR (e.g. Tesseract) would add significant complexity for scanned documents |
| Single-page tabs vs separate routes | Keeps both features in one app as confirmed by hiring team; shared input state between tabs avoids re-uploading files |
| Fallback extraction | Ensures app works during demo even if API key is missing or rate-limited; clearly indicated in UI |
| Share via URL hash | Stateless — no database required; works offline; reviewer can open results without running the backend |
| window.print() for export | Zero dependencies; produces a clean PDF via any browser's print dialog |

## Project Structure

```
Resume_Screener/
├── backend/
│   ├── api/
│   │   ├── services/
│   │   │   ├── ai_service.py    # AI skill extraction, comparison, verdict
│   │   │   └── file_parser.py   # PDF & DOCX text extraction
│   │   ├── views.py             # REST endpoints
│   │   ├── serializers.py       # Input validation
│   │   └── urls.py
│   ├── resume_screener/         # Django settings
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js pages & global styles
│   │   ├── components/          # UI components
│   │   │   ├── InputPanel.tsx       # Text + file upload inputs
│   │   │   ├── SkillGapResult.tsx   # Chart, tags, share/export
│   │   │   ├── FitVerdictResult.tsx # Verdict badge, reasons
│   │   │   ├── LoadingPanel.tsx     # Multi-step animated loader
│   │   │   └── ThemeToggle.tsx      # Dark/light mode switch
│   │   └── lib/
│   │       ├── api.ts           # API client (fetch wrappers)
│   │       └── theme.tsx        # Theme context & provider
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Author

Shyam Pattipu

## License

MIT
