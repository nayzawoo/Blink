import type { ReactNode } from "react"

import { clamp, downsample } from "@/lib/format"
import type { HistoryPoint } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SparklineProps {
  values: number[]
  className?: string
  strokeClassName?: string
  fillClassName?: string
}

export function Sparkline({ values, className, strokeClassName, fillClassName }: SparklineProps) {
  if (values.length < 2) {
    return (
      <div
        className={cn(
          "flex items-end justify-center rounded-md border border-dashed border-border/60 text-[10px] text-muted-foreground",
          className
        )}
      >
        collecting samples…
      </div>
    )
  }

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100
    const y = 100 - clamp(value, 0, 100)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const line = `M ${points.join(" L ")}`
  const area = `${line} L 100,100 L 0,100 Z`

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      aria-hidden="true"
    >
      {fillClassName && <path d={area} className={fillClassName} stroke="none" />}
      <path
        d={line}
        fill="none"
        className={cn("stroke-current", strokeClassName)}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

interface RadialGaugeProps {
  value: number
  label: string
  sublabel?: ReactNode
  strokeClassName?: string
}

export function RadialGauge({ value, label, sublabel, strokeClassName }: RadialGaugeProps) {
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const percent = clamp(value, 0, 100)

  return (
    <div className="flex min-w-20 flex-col items-center">
      <div className="relative size-20">
        <svg viewBox="0 0 100 100" className="size-20 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            className={cn("stroke-foreground transition-[stroke-dashoffset] duration-500", strokeClassName)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-semibold tabular-nums">{Math.round(percent)}%</span>
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
      </div>
      {sublabel && <span className="mt-1 text-center text-[11px] text-muted-foreground">{sublabel}</span>}
    </div>
  )
}

const HISTORY_SERIES = [
  { key: "cpu_pct", label: "CPU", stroke: "stroke-sky-500" },
  { key: "mem_used_pct", label: "RAM", stroke: "stroke-violet-500" },
  { key: "disk_used_pct", label: "Disk", stroke: "stroke-amber-500" },
] as const

export function HistoryChart({ history, className }: { history: HistoryPoint[]; className?: string }) {
  const points = downsample(history, 180)

  if (points.length < 2) {
    return (
      <div className={cn("flex items-center justify-center text-xs text-muted-foreground", className)}>
        Waiting for history samples…
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-36 w-full" aria-hidden="true">
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            className="stroke-border"
            strokeWidth={0.5}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {HISTORY_SERIES.map((series) => {
          const line = points
            .map((point, index) => {
              const x = (index / (points.length - 1)) * 100
              const y = 100 - clamp(point[series.key], 0, 100)
              return `${x.toFixed(2)},${y.toFixed(2)}`
            })
            .join(" L ")

          return (
            <path
              key={series.key}
              d={`M ${line}`}
              fill="none"
              className={series.stroke}
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {HISTORY_SERIES.map((series) => (
          <span key={series.key} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block size-2 rounded-full bg-current", series.stroke.replace("stroke", "text"))} />
            {series.label}
          </span>
        ))}
        <span className="ml-auto">last 60 minutes</span>
      </div>
    </div>
  )
}
