"use client";

import { useEffect, useRef, useState } from "react";
import type { SkillGapResult as SkillGapData } from "@/lib/api";
import styles from "./SkillGapResult.module.css";

interface Props {
  data: SkillGapData;
}

function SkillTags({
  skills,
  variant,
  animate = false,
}: {
  skills: string[];
  variant: "success" | "danger" | "neutral";
  animate?: boolean;
}) {
  const cls =
    variant === "success"
      ? styles.tagSuccess
      : variant === "danger"
      ? styles.tagDanger
      : styles.tagNeutral;

  return (
    <div className={styles.tags}>
      {skills.map((skill, i) => (
        <span
          key={skill}
          className={cls}
          style={
            animate
              ? { animation: `tagEnter 0.35s ease both ${i * 0.04}s` }
              : undefined
          }
        >
          {skill}
        </span>
      ))}
    </div>
  );
}

function RadialChart({ matched, missing, extra }: { matched: number; missing: number; extra: number }) {
  const total = matched + missing;
  if (total === 0) return null;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 72;
  const stroke = 18;
  const circumference = 2 * Math.PI * r;

  function arc(value: number, total: number, offset: number) {
    const pct = value / total;
    return { dash: pct * circumference, offset: -offset * circumference };
  }

  const matchedArc = arc(matched, total, 0);
  const missingArc = arc(missing, total, matched / total);
  const matchPct = Math.round((matched / total) * 100);

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={styles.chartSvg}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {/* Missing */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--danger)"
          strokeWidth={stroke}
          strokeDasharray={`${missingArc.dash} ${circumference}`}
          strokeDashoffset={missingArc.offset}
          strokeLinecap="round"
          className={styles.arcAnimate}
          style={{ "--arc-dash": missingArc.dash, "--arc-circ": circumference } as React.CSSProperties}
        />
        {/* Matched */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--success)"
          strokeWidth={stroke}
          strokeDasharray={`${matchedArc.dash} ${circumference}`}
          strokeDashoffset={matchedArc.offset}
          strokeLinecap="round"
          className={styles.arcAnimate}
          style={{ "--arc-dash": matchedArc.dash, "--arc-circ": circumference } as React.CSSProperties}
        />
        {/* Center text */}
        <text x={cx} y={cy - 10} textAnchor="middle" className={styles.chartPct}>{matchPct}%</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className={styles.chartLabel}>Match</text>
      </svg>

      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--success)" }} />
          <span>Matched: <strong>{matched}</strong></span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--danger)" }} />
          <span>Missing: <strong>{missing}</strong></span>
        </div>
        {extra > 0 && (
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: "var(--accent)" }} />
            <span>Extra: <strong>{extra}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SkillGapResult({ data }: Props) {
  const {
    matched_skills,
    missing_skills,
    extra_skills = [],
    match_percentage,
    resume_skills,
    jd_skills,
    ai_powered,
  } = data;

  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const verdictColor =
    match_percentage >= 75
      ? "var(--success)"
      : match_percentage >= 45
      ? "var(--warning)"
      : "var(--danger)";

  // Share — encode result as base64 in URL hash
  function handleShare() {
    const payload = JSON.stringify({ type: "skill-gap", data });
    const encoded = btoa(encodeURIComponent(payload));
    const url = `${window.location.origin}${window.location.pathname}#result=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Export as PDF via browser print
  function handleExport() {
    window.print();
  }

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [data]);

  return (
    <div ref={cardRef} className={styles.card}>
      {/* Header row */}
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>🎯 Skill Gap Analysis</h2>
        <div className={styles.actions}>
          {ai_powered === false && (
            <span className={styles.fallbackPill}>⚡ Keyword mode</span>
          )}
          <button
            id="btn-share-skillgap"
            className={styles.actionBtn}
            onClick={handleShare}
            title="Copy shareable link"
          >
            {copied ? "✓ Copied!" : "🔗 Share"}
          </button>
          <button
            id="btn-export-skillgap"
            className={styles.actionBtn}
            onClick={handleExport}
            title="Export as PDF"
          >
            📄 Export
          </button>
        </div>
      </div>

      {/* Chart */}
      <RadialChart
        matched={matched_skills.length}
        missing={missing_skills.length}
        extra={extra_skills.length}
      />

      {/* Match percentage bar */}
      <div className={styles.percentBar}>
        <div className={styles.percentBarTrack}>
          <div
            className={styles.percentBarFill}
            style={{ width: `${match_percentage}%`, background: verdictColor }}
          />
        </div>
        <span className={styles.percentLabel} style={{ color: verdictColor }}>
          {match_percentage}% match
        </span>
      </div>

      {/* Matched */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.dot} style={{ background: "var(--success)" }} />
          Matched Skills
          <span className={styles.count}>{matched_skills.length}</span>
        </h3>
        {matched_skills.length > 0 ? (
          <SkillTags skills={matched_skills} variant="success" animate />
        ) : (
          <p className={styles.empty}>No matching skills found.</p>
        )}
      </div>

      {/* Missing */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.dot} style={{ background: "var(--danger)" }} />
          Missing Skills
          <span className={styles.count}>{missing_skills.length}</span>
        </h3>
        {missing_skills.length > 0 ? (
          <SkillTags skills={missing_skills} variant="danger" animate />
        ) : (
          <p className={styles.empty}>No missing skills — great match! 🎉</p>
        )}
      </div>

      {/* Bonus */}
      {extra_skills.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.dot} style={{ background: "var(--accent)" }} />
            Bonus Skills
            <span className={styles.count}>{extra_skills.length}</span>
          </h3>
          <SkillTags skills={extra_skills} variant="neutral" animate />
        </div>
      )}

      {/* Collapsible extracted skills */}
      <div className={styles.detailsSection}>
        <button
          className={styles.detailsToggle}
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
        >
          <span>{showDetails ? "▾" : "▸"}</span>
          View all extracted skills ({resume_skills.length} resume · {jd_skills.length} JD)
        </button>
        {showDetails && (
          <div className={styles.extractedGrid}>
            <div>
              <h4 className={styles.extractedTitle}>From Resume ({resume_skills.length})</h4>
              <SkillTags skills={resume_skills} variant="neutral" animate />
            </div>
            <div>
              <h4 className={styles.extractedTitle}>From Job Description ({jd_skills.length})</h4>
              <SkillTags skills={jd_skills} variant="neutral" animate />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
