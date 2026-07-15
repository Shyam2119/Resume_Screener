"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LoadingPanel.module.css";

const STEPS = [
  { icon: "📄", label: "Extracting skills from resume…" },
  { icon: "💼", label: "Analyzing job description…" },
  { icon: "🤖", label: "Running AI comparison…" },
  { icon: "✨", label: "Generating insights…" },
];

const STEP_DURATION_MS = 1800;

export default function LoadingPanel() {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  // Use a ref so the progress interval always reads the latest step value
  const stepRef = useRef(0);

  useEffect(() => {
    // Advance step every STEP_DURATION_MS, capped at last step
    const stepInterval = setInterval(() => {
      setStep((s) => {
        const next = s < STEPS.length - 1 ? s + 1 : s;
        stepRef.current = next;
        return next;
      });
    }, STEP_DURATION_MS);

    // Advance progress bar smoothly, targeting ((currentStep+1)/total)*100
    const progInterval = setInterval(() => {
      setProgress((p) => {
        const target = Math.min(
          ((stepRef.current + 1) / STEPS.length) * 100,
          95 // never reach 100 until truly done
        );
        return p < target ? Math.min(p + 1.2, target) : p;
      });
    }, 60);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progInterval);
    };
  }, []); // intentionally run once — stepRef keeps it in sync

  return (
    <div className={styles.panel} role="status" aria-label="Analyzing your resume…">
      {/* Shimmer skeleton */}
      <div className={styles.skeleton} aria-hidden="true">
        <div className={styles.skeletonRow} style={{ width: "60%" }} />
        <div className={styles.skeletonRow} style={{ width: "80%" }} />
        <div className={styles.skeletonRow} style={{ width: "45%" }} />
      </div>

      {/* Progress bar */}
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {/* Steps list */}
      <div className={styles.steps}>
        {STEPS.map((s, i) => (
          <div
            key={s.label}
            className={`${styles.step} ${
              i < step
                ? styles.stepDone
                : i === step
                ? styles.stepActive
                : styles.stepPending
            }`}
          >
            <span className={styles.stepIcon}>{i < step ? "✓" : s.icon}</span>
            <span className={styles.stepLabel}>{s.label}</span>
            {i === step && <span className={styles.stepDots} aria-hidden="true" />}
          </div>
        ))}
      </div>

      <p className={styles.hint}>This may take a few seconds with AI…</p>
    </div>
  );
}
