"use client";

import { useEffect, useRef, useState } from "react";
import type { FitVerdictResult as FitVerdictData } from "@/lib/api";
import styles from "./FitVerdictResult.module.css";

interface Props {
  data: FitVerdictData;
}

const VERDICT_CONFIG = {
  Qualified: {
    color: "var(--success)",
    glow: "rgba(16, 185, 129, 0.3)",
    dimGlow: "rgba(16, 185, 129, 0.1)",
    gradient: "var(--grad-success)",
    icon: "🎉",
    emoji: "🟢",
    description: "Strong fit for this role",
    bgClass: "success",
  },
  "Almost There": {
    color: "var(--warning)",
    glow: "rgba(245, 158, 11, 0.3)",
    dimGlow: "rgba(245, 158, 11, 0.1)",
    gradient: "var(--grad-warning)",
    icon: "🌟",
    emoji: "🟡",
    description: "Good potential with some gaps",
    bgClass: "warning",
  },
  "Not Yet": {
    color: "var(--danger)",
    glow: "rgba(239, 68, 68, 0.3)",
    dimGlow: "rgba(239, 68, 68, 0.1)",
    gradient: "var(--grad-danger)",
    icon: "🔄",
    emoji: "🔴",
    description: "Significant gaps to address",
    bgClass: "danger",
  },
} as const;

export default function FitVerdictResult({ data }: Props) {
  const { verdict, reasons, ai_powered } = data;
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG["Not Yet"];
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  function handleShare() {
    const payload = JSON.stringify({ type: "fit-verdict", data });
    const encoded = btoa(encodeURIComponent(payload));
    const url = `${window.location.origin}${window.location.pathname}#result=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleExport() {
    window.print();
  }

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [data]);

  return (
    <div ref={cardRef} className={styles.card}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>🏆 Fit Verdict</h2>
        <div className={styles.actions}>
          {ai_powered === false && (
            <span className={styles.fallbackPill}>⚡ Rule-based</span>
          )}
          <button
            id="btn-share-verdict"
            className={styles.actionBtn}
            onClick={handleShare}
            title="Copy shareable link"
          >
            {copied ? "✓ Copied!" : "🔗 Share"}
          </button>
          <button
            id="btn-export-verdict"
            className={styles.actionBtn}
            onClick={handleExport}
            title="Export as PDF"
          >
            📄 Export
          </button>
        </div>
      </div>

      {/* Verdict badge */}
      <div className={`${styles.verdictSection} ${styles[config.bgClass]}`}>
        <div
          className={styles.verdictBadge}
          style={{
            borderColor: config.color,
            boxShadow: `0 0 40px ${config.glow}, 0 0 80px ${config.dimGlow}`,
          }}
        >
          <span className={styles.verdictIcon}>{config.icon}</span>
          <div className={styles.verdictInfo}>
            <span className={styles.verdictText} style={{ color: config.color }}>
              {verdict}
            </span>
            <span className={styles.verdictDesc}>{config.description}</span>
          </div>
        </div>
      </div>

      {/* Reasons */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Supporting Reasons</h3>
        <ol className={styles.reasons}>
          {reasons.map((reason, i) => (
            <li
              key={i}
              className={styles.reason}
              style={{ animation: `slideUp 0.4s ease both ${i * 0.1 + 0.1}s` }}
            >
              <span
                className={styles.reasonNumber}
                style={{ background: config.gradient }}
              >
                {i + 1}
              </span>
              <span className={styles.reasonText}>{reason}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Legend */}
      <div className={styles.verdictLegend}>
        {(["Qualified", "Almost There", "Not Yet"] as const).map((v) => {
          const cfg = VERDICT_CONFIG[v];
          return (
            <div
              key={v}
              className={`${styles.legendItem} ${verdict === v ? styles.legendActive : ""}`}
              style={verdict === v ? { borderColor: cfg.color, color: cfg.color } : {}}
            >
              <span>{cfg.emoji}</span>
              <span>{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
