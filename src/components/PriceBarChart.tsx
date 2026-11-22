import { useState } from 'react'
import { BASELINE_START_HOUR, formatEur, formatHour } from '../lib/shiftWindow'

interface PriceBarChartProps {
  prices: readonly number[]
  startHour: number
  endHour: number
  powerMw: number
}

const CHART_WIDTH = 960
const CHART_HEIGHT = 320
const PADDING = { top: 24, right: 20, bottom: 44, left: 54 }
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom

function buildYAxis(prices: readonly number[]) {
  const minPrice = Math.min(0, ...prices)
  const maxPrice = Math.max(0, ...prices)
  const step = 50
  const yMin = Math.floor(minPrice / step) * step
  const yMax = Math.max(step, Math.ceil(maxPrice / step) * step)

  const ticks: number[] = []
  for (let v = yMin; v <= yMax; v += step) {
    ticks.push(v)
  }
  return { yMin, yMax, ticks }
}

export function PriceBarChart({ prices, startHour, endHour, powerMw }: PriceBarChartProps) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null)

  const { yMin, yMax, ticks } = buildYAxis(prices)
  const ySpan = yMax - yMin
  const toY = (value: number) => PADDING.top + ((yMax - value) / ySpan) * PLOT_HEIGHT
  const zeroY = toY(0)

  const slotWidth = PLOT_WIDTH / prices.length
  const barWidth = slotWidth * 0.68
  const barOffset = (slotWidth - barWidth) / 2

  const windowX = PADDING.left + startHour * slotWidth
  const windowWidth = (endHour - startHour) * slotWidth
  const baselineX = PADDING.left + BASELINE_START_HOUR * slotWidth + slotWidth / 2

  const activeHour = hoveredHour ?? startHour
  const activePrice = prices[activeHour]
  const activeHourlyCost = activePrice * powerMw
  const activeInWindow = activeHour >= startHour && activeHour < endHour

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            24-Hour Electricity Prices (00:00 – 23:00)
          </h2>
          <p className="text-xs text-slate-500">
            Hourly prices in €/MWh · cheapest consecutive hours highlighted in green
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
            <span>Cheapest window</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-xs bg-slate-300" />
            <span>Other hours</span>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700 tabular-nums">
            <span className="text-slate-500">{formatHour(activeHour)}</span>{' '}
            <span className={activeInWindow ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-900'}>
              {activePrice} €/MWh
            </span>{' '}
            <span className="text-slate-500">({formatEur(activeHourlyCost)}/h)</span>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label="24-hour German electricity price bar chart in euros per megawatt-hour"
      >
        <rect
          x={windowX}
          y={PADDING.top}
          width={windowWidth}
          height={PLOT_HEIGHT}
          fill="#ecfdf5"
          rx={4}
        />

        {ticks.map((tick) => {
          const y = toY(tick)
          const isZero = tick === 0
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={CHART_WIDTH - PADDING.right}
                y2={y}
                stroke={isZero ? '#64748b' : '#e2e8f0'}
                strokeWidth={isZero ? 1.25 : 1}
              />
              <text
                x={PADDING.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 font-mono text-[11px]"
              >
                {tick}
              </text>
            </g>
          )
        })}

        <line
          x1={baselineX}
          y1={PADDING.top}
          x2={baselineX}
          y2={PADDING.top + PLOT_HEIGHT}
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={baselineX}
          y={PADDING.top - 7}
          textAnchor="middle"
          className="fill-slate-400 font-mono text-[10px]"
        >
          09:00 ref
        </text>

        {prices.map((price, hour) => {
          const inWindow = hour >= startHour && hour < endHour
          const isHovered = hoveredHour === hour
          const x = PADDING.left + hour * slotWidth + barOffset
          const valueY = toY(price)
          const barY = price >= 0 ? valueY : zeroY
          const barHeight = Math.max(2, Math.abs(zeroY - valueY))

          let fill = inWindow ? '#059669' : '#cbd5e1'
          if (isHovered) {
            fill = inWindow ? '#047857' : '#94a3b8'
          }

          const showXLabel = hour % 3 === 0 || hour === 23

          return (
            <g
              key={hour}
              onMouseEnter={() => setHoveredHour(hour)}
              onMouseLeave={() => setHoveredHour(null)}
              className="cursor-pointer"
            >
              {/* Full-height hit target keeps hover responsive on short or negative bars. */}
              <rect
                x={PADDING.left + hour * slotWidth}
                y={PADDING.top}
                width={slotWidth}
                height={PLOT_HEIGHT}
                fill="transparent"
              />
              <rect
                x={x}
                y={barY}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={fill}
              />
              {showXLabel && (
                <text
                  x={PADDING.left + hour * slotWidth + slotWidth / 2}
                  y={CHART_HEIGHT - 14}
                  textAnchor="middle"
                  className={
                    inWindow
                      ? 'fill-emerald-700 font-mono text-[11px] font-semibold'
                      : 'fill-slate-500 font-mono text-[11px]'
                  }
                >
                  {formatHour(hour)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
