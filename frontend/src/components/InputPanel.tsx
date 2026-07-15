"use client";

import { useRef, useState, useCallback } from "react";
import styles from "./InputPanel.module.css";
import { parseFile } from "@/lib/api";

const MIN_LENGTH = 10;
const MAX_FILE_MB = 5;

interface Props {
  resume: string;
  jobDescription: string;
  onResumeChange: (value: string) => void;
  onJobDescriptionChange: (value: string) => void;
  onAnalyze: () => void;
  onLoadSample: () => void;
  onClear: () => void;
  loading: boolean;
  isStale: boolean;
}

type UploadField = "resume" | "jd";

export default function InputPanel({
  resume,
  jobDescription,
  onResumeChange,
  onJobDescriptionChange,
  onAnalyze,
  onLoadSample,
  onClear,
  loading,
  isStale,
}: Props) {
  const resumeFileRef = useRef<HTMLInputElement>(null);
  const jdFileRef = useRef<HTMLInputElement>(null);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<UploadField | null>(null);

  const resumeValid = resume.trim().length >= MIN_LENGTH;
  const jdValid = jobDescription.trim().length >= MIN_LENGTH;
  const isUploading = uploadingField !== null;
  const canAnalyze = resumeValid && jdValid && !loading && !isUploading;

  // Character bar: clamp to 0-100% based on 3000 chars being "full"
  const resumeBarPct = Math.min((resume.trim().length / 3000) * 100, 100);
  const jdBarPct = Math.min((jobDescription.trim().length / 3000) * 100, 100);

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canAnalyze) {
      onAnalyze();
    }
  }

  const handleFileUpload = useCallback(
    async (file: File, field: UploadField) => {
      setUploadError(null);
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setUploadError(`File too large (max ${MAX_FILE_MB} MB).`);
        return;
      }
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "doc", "docx"].includes(ext ?? "")) {
        setUploadError("Only PDF and DOCX files are supported.");
        return;
      }
      setUploadingField(field);
      try {
        const result = await parseFile(file);
        if (field === "resume") onResumeChange(result.text);
        else onJobDescriptionChange(result.text);
        setUploadError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "File parse failed";
        setUploadError(msg);
        // Auto-clear error after 5 s
        setTimeout(() => setUploadError(null), 5000);
      } finally {
        setUploadingField(null);
      }
    },
    [onResumeChange, onJobDescriptionChange]
  );

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>, field: UploadField) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, field);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent, field: UploadField) {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file, field);
  }

  function handleDragOver(e: React.DragEvent, field: UploadField) {
    e.preventDefault();
    setDragOver(field);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if truly leaving the drop zone (not entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(null);
    }
  }

  const charLabel = (len: number, valid: boolean) =>
    valid ? (
      <span className={styles.charCountOk}>{len} chars</span>
    ) : len === 0 ? (
      <span className={styles.charCount}>—</span>
    ) : (
      <span className={styles.charCountWarn}>{len} chars (too short)</span>
    );

  const barColor = (pct: number, valid: boolean) =>
    !valid
      ? "var(--warning)"
      : pct > 70
      ? "var(--success)"
      : "var(--accent)";

  return (
    <div className={styles.panel} onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Input</span>
        <div className={styles.toolbar}>
          <button
            id="btn-load-sample"
            type="button"
            className={styles.secondaryBtn}
            onClick={onLoadSample}
            disabled={loading}
          >
            Load Sample
          </button>
          <button
            id="btn-clear"
            type="button"
            className={styles.secondaryBtn}
            onClick={onClear}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className={styles.uploadError} role="alert">
          ⚠ {uploadError}
        </div>
      )}

      {/* Stale banner */}
      {isStale && (
        <div className={styles.staleBanner}>
          <span>⟳</span> Inputs changed — re-analyze to refresh results
        </div>
      )}

      {/* Resume field */}
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.fieldLabel} htmlFor="resume">
            📄 Resume
          </label>
          {charLabel(resume.trim().length, resumeValid)}
        </div>

        {/* Drop zone */}
        <div
          className={`${styles.dropZone} ${dragOver === "resume" ? styles.dropZoneActive : ""}`}
          onDrop={(e) => handleDrop(e, "resume")}
          onDragOver={(e) => handleDragOver(e, "resume")}
          onDragLeave={handleDragLeave}
        >
          <textarea
            id="resume"
            className={styles.textarea}
            value={resume}
            onChange={(e) => onResumeChange(e.target.value)}
            placeholder="Paste resume text here, or upload a PDF / DOCX file…"
            rows={9}
            aria-invalid={!resumeValid}
          />
          {dragOver === "resume" && (
            <div className={styles.dropOverlay}>Drop PDF or DOCX here</div>
          )}
        </div>

        <div className={styles.fieldFooter}>
          <div className={styles.charBar}>
            <div
              className={styles.charBarFill}
              style={{
                width: `${resumeBarPct}%`,
                background: barColor(resumeBarPct, resumeValid),
              }}
            />
          </div>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={() => resumeFileRef.current?.click()}
            disabled={loading || uploadingField === "resume"}
            title="Upload PDF or DOCX"
          >
            {uploadingField === "resume" ? (
              <><span className={styles.spinner} /> Parsing…</>
            ) : (
              <>📎 Upload PDF / DOCX</>
            )}
          </button>
          <input
            ref={resumeFileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className={styles.hiddenInput}
            onChange={(e) => handleFileInput(e, "resume")}
          />
        </div>
      </div>

      {/* JD field */}
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.fieldLabel} htmlFor="jd">
            💼 Job Description
          </label>
          {charLabel(jobDescription.trim().length, jdValid)}
        </div>

        <div
          className={`${styles.dropZone} ${dragOver === "jd" ? styles.dropZoneActive : ""}`}
          onDrop={(e) => handleDrop(e, "jd")}
          onDragOver={(e) => handleDragOver(e, "jd")}
          onDragLeave={handleDragLeave}
        >
          <textarea
            id="jd"
            className={styles.textarea}
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder="Paste job description here, or upload a PDF / DOCX file…"
            rows={9}
            aria-invalid={!jdValid}
          />
          {dragOver === "jd" && (
            <div className={styles.dropOverlay}>Drop PDF or DOCX here</div>
          )}
        </div>

        <div className={styles.fieldFooter}>
          <div className={styles.charBar}>
            <div
              className={styles.charBarFill}
              style={{
                width: `${jdBarPct}%`,
                background: barColor(jdBarPct, jdValid),
              }}
            />
          </div>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={() => jdFileRef.current?.click()}
            disabled={loading || uploadingField === "jd"}
            title="Upload PDF or DOCX"
          >
            {uploadingField === "jd" ? (
              <><span className={styles.spinner} /> Parsing…</>
            ) : (
              <>📎 Upload PDF / DOCX</>
            )}
          </button>
          <input
            ref={jdFileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className={styles.hiddenInput}
            onChange={(e) => handleFileInput(e, "jd")}
          />
        </div>
      </div>

      {/* Analyze button */}
      <button
        id="btn-analyze"
        type="button"
        className={styles.button}
        onClick={onAnalyze}
        disabled={!canAnalyze}
      >
        {loading ? (
          <><span className={styles.buttonLoading} /> Analyzing…</>
        ) : (
          <>✨ Analyze Resume</>
        )}
      </button>

      <p className={styles.hint}>
        <kbd className={styles.kbd}>Ctrl</kbd>+<kbd className={styles.kbd}>Enter</kbd> to analyze
        &nbsp;·&nbsp; runs both features at once
      </p>
    </div>
  );
}
