// web/src/components/Timeline.tsx
"use client";

import React from "react";

export default function Timeline({
  counts,
  width = 360,
  height = 56,
  barColor = "currentColor",
  className = "",
  title,
}: {
  counts: number[]; // oldest -> newest
  width?: number;
  height?: number;
  barColor?: string;
  className?: string;
  title?: string;
}) {
  if (!counts || counts.length === 0) return null;
  const max = Math.max(...counts, 1);
  const gap = 4;
  const barW = Math.max(2, Math.floor((width - gap * (counts.length - 1)) / counts.length));
  const chartW = barW * counts.length + gap * (counts.length - 1);
  const chartH = height;

  return (
    <svg
      width={chartW}
      height={chartH}
      viewBox={`0 0 ${chartW} ${chartH}`}
      className={className}
      aria-label={title}
      role="img"
    >
      {title ? <title>{title}</title> : null}
      {counts.map((c, i) => {
        const h = Math.max(1, Math.round((c / max) * (chartH - 4)));
        const x = i * (barW + gap);
        const y = chartH - h;
        return <rect key={i} x={x} y={y} width={barW} height={h} rx={2} ry={2} fill={barColor} />;
      })}
    </svg>
  );
}
