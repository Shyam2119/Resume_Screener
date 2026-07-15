"use client";

import { useCallback, useState } from "react";
import styles from "./page.module.css";
import InputPanel from "@/components/InputPanel";
import SkillGapResult from "@/components/SkillGapResult";
import FitVerdictResult from "@/components/FitVerdictResult";
import LoadingPanel from "@/components/LoadingPanel";
import ThemeToggle from "@/components/ThemeToggle";
import {
  analyzeAll,
  type Tab,
  type SkillGapResult as SkillGapData,
  type FitVerdictResult as FitVerdictData,
} from "@/lib/api";

const SAMPLE_RESUME = `Shyam Pattipu — Full Stack Developer

Skills: React, JavaScript, TypeScript, Redux, HTML, CSS, Node.js, Python, Django, Git
Experience: 2+ years building web applications with React and Django REST APIs.
Education: B.Tech in Computer Science`;

const SAMPLE_JD = `Full Stack Developer

Required Skills: React, TypeScript, Redux, AWS, Docker, Python, PostgreSQL, Django
Experience with AI/ML libraries (TensorFlow, PyTorch) is a plus.
Strong knowledge of Git and CI/CD pipelines.`;

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("skill-gap");
  const [resume, setResume] = useState(SAMPLE_RESUME);
  const [jobDescription, setJobDescription] = useState(SAMPLE_JD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillGapData, setSkillGapData] = useState<SkillGapData | null>(null);
  const [verdictData, setVerdictData] = useState<FitVerdictData | null>(null);
  const [lastAnalyzedInput, setLastAnalyzedInput] = useState<string | null>(null);

  const inputFingerprint = `${resume}|||${jobDescription}`;
  const isStale = lastAnalyzedInput !== null && lastAnalyzedInput !== inputFingerprint;

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    const fingerprint = `${resume}|||${jobDescription}`;
    try {
      const result = await analyzeAll(resume, jobDescription);
      setSkillGapData(result.skill_gap);
      setVerdictData(result.fit_verdict);
      setLastAnalyzedInput(fingerprint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [resume, jobDescription]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setError(null);
  }

  function handleLoadSample() {
    setResume(SAMPLE_RESUME);
    setJobDescription(SAMPLE_JD);
  }

  function handleClear() {
    setResume("");
    setJobDescription("");
    setSkillGapData(null);
    setVerdictData(null);
    setLastAnalyzedInput(null);
    setError(null);
  }

  const hasResults = skillGapData !== null && verdictData !== null;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <ThemeToggle />
        <div className={styles.logoWrap}>
          <span className={styles.aiBadge}>Powered by Gemini AI</span>
          <h1 className={styles.logo}>Resume Screener</h1>
          <p className={styles.subtitle}>
            AI-powered resume analysis — skill gap checker &amp; fit verdict
          </p>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Analysis features">
        <button
          id="tab-skill-gap"
          role="tab"
          aria-selected={activeTab === "skill-gap"}
          aria-controls="panel-skill-gap"
          className={`${styles.tab} ${activeTab === "skill-gap" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("skill-gap")}
        >
          🎯 Skill Gap Checker
          {hasResults && skillGapData && (
            <span className={styles.tabBadge}>{skillGapData.match_percentage}%</span>
          )}
        </button>
        <button
          id="tab-fit-verdict"
          role="tab"
          aria-selected={activeTab === "fit-verdict"}
          aria-controls="panel-fit-verdict"
          className={`${styles.tab} ${activeTab === "fit-verdict" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("fit-verdict")}
        >
          🏆 Fit Verdict
          {hasResults && verdictData && (
            <span className={styles.tabBadge}>{verdictData.verdict}</span>
          )}
        </button>
      </div>

      <div className={styles.content}>
        <InputPanel
          resume={resume}
          jobDescription={jobDescription}
          onResumeChange={setResume}
          onJobDescriptionChange={setJobDescription}
          onAnalyze={handleAnalyze}
          onLoadSample={handleLoadSample}
          onClear={handleClear}
          loading={loading}
          isStale={isStale}
        />

        <div
          className={styles.results}
          role="tabpanel"
          id={activeTab === "skill-gap" ? "panel-skill-gap" : "panel-fit-verdict"}
          aria-labelledby={activeTab === "skill-gap" ? "tab-skill-gap" : "tab-fit-verdict"}
        >
          {error && <div className={styles.error} role="alert">{error}</div>}

          {loading && <LoadingPanel />}

          {!loading && activeTab === "skill-gap" && skillGapData && (
            <SkillGapResult data={skillGapData} />
          )}

          {!loading && activeTab === "fit-verdict" && verdictData && (
            <FitVerdictResult data={verdictData} />
          )}

          {!error && !loading && !hasResults && (
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon} aria-hidden="true">🔍</span>
              <p className={styles.placeholderTitle}>Ready to Analyze</p>
              <p>
                Paste your resume and a job description, then click{" "}
                <strong>Analyze Resume</strong> to instantly get:
              </p>
              <div className={styles.placeholderSteps}>
                <div className={styles.placeholderStep}>
                  <span>🎯</span> Matched &amp; missing skills with match %
                </div>
                <div className={styles.placeholderStep}>
                  <span>🏆</span> Qualified / Almost There / Not Yet verdict
                </div>
                <div className={styles.placeholderStep}>
                  <span>✨</span> 3 AI-generated supporting reasons
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
