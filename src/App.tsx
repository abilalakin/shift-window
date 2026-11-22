import { useRef, useState } from 'react'
import { PriceBarChart } from './components/PriceBarChart'
import { DEFAULT_OLLAMA_MODEL, askOllama, buildShiftPrompt } from './lib/ollama'
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_POWER_MW,
  MAX_DURATION_HOURS,
  MAX_POWER_MW,
  MIN_DURATION_HOURS,
  MIN_POWER_MW,
  PRICE_CURVES,
  type CurveId,
  findOptimalWindow,
  formatEur,
  formatWindowRange,
} from './lib/shiftWindow'

const CURVE_IDS: CurveId[] = ['sunny-weekday', 'winter-peak']
const SUGGESTED_QUESTION = 'Why is this time window cheaper than starting at 09:00?'

export default function App() {
  const [curveId, setCurveId] = useState<CurveId>('sunny-weekday')
  const [durationHours, setDurationHours] = useState<number>(DEFAULT_DURATION_HOURS)
  const [powerMw, setPowerMw] = useState<number>(DEFAULT_POWER_MW)

  const [aiOpen, setAiOpen] = useState(false)
  const [model, setModel] = useState(DEFAULT_OLLAMA_MODEL)
  const [question, setQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const curve = PRICE_CURVES[curveId]
  const result = findOptimalWindow(curve.prices, durationHours, powerMw)
  const totalEnergyMwh = durationHours * powerMw
  const avgPriceEurPerMwh = Math.round(result.totalCostEur / totalEnergyMwh)

  async function handleAskAi() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setAiLoading(true)
    setAiError(null)

    try {
      const prompt = buildShiftPrompt(
        { curve, durationHours, powerMw, result },
        question,
      )
      const response = await askOllama({
        prompt,
        model: model.trim() || DEFAULT_OLLAMA_MODEL,
        signal: controller.signal,
      })
      setAiAnswer(response)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setAiAnswer(null)
      setAiError(err instanceof Error ? err.message : 'Failed to get AI response.')
    } finally {
      if (abortRef.current === controller) {
        setAiLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                ShiftWindow
              </h1>
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                Germany €/MWh
              </span>
            </div>
            <p className="mt-1.5 text-sm text-slate-600">
              Find the cheapest hours of the day to run a high-power job using hourly German electricity prices.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{curve.label}:</span> {curve.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5"
              role="group"
              aria-label="Electricity price curve"
            >
              {CURVE_IDS.map((id) => {
                const active = id === curveId
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCurveId(id)}
                    className={
                      active
                        ? 'rounded-sm bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-900 shadow-xs'
                        : 'rounded-sm px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900'
                    }
                  >
                    {PRICE_CURVES[id].label}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setAiOpen((open) => !open)}
              className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              {aiOpen ? 'Hide AI' : 'Ask AI'}
            </button>
          </div>
        </header>

        {aiOpen && (
          <section
            className="mb-5 rounded-lg border border-emerald-200 bg-white p-4 shadow-xs"
            aria-label="Ask local Ollama AI"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Ask AI (Local Ollama)</h2>
                <p className="text-xs text-slate-500">
                  Sends the active curve, sliders, savings, and all 24 hourly prices to your local model.
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Model</span>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-36 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </label>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAskAi()
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && !e.shiftKey && question.trim() === '') {
                    e.preventDefault()
                    setQuestion(SUGGESTED_QUESTION)
                  }
                }}
                placeholder={`e.g. ${SUGGESTED_QUESTION} (Tab to fill)`}
                className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {aiLoading ? 'Thinking…' : 'Send'}
              </button>
            </form>

            {aiError && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {aiError}
              </p>
            )}

            {aiAnswer && !aiError && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                {aiAnswer}
              </div>
            )}
          </section>
        )}

        <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Schedule summary">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Best Start Time
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-emerald-700 tabular-nums">
              {formatWindowRange(result.startHour, result.endHour)}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
              {durationHours}h run · {totalEnergyMwh} MWh used
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Total Cost
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {formatEur(result.totalCostEur)}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
              Avg {avgPriceEurPerMwh} €/MWh{result.totalCostEur < 0 ? ' · paid to use power' : ''}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Savings vs. 09:00 Start
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="font-mono text-2xl font-semibold tracking-tight text-emerald-700 tabular-nums">
                {formatEur(result.savingsEur)}
              </p>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                {result.savingsPercent === null
                  ? '—'
                  : `${result.savingsPercent.toFixed(1)}%`}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
              09:00 start costs {formatEur(result.baselineCostEur)}
            </p>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="duration-slider" className="text-xs font-semibold text-slate-700">
                Load Duration
              </label>
              <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {durationHours} {durationHours === 1 ? 'hour' : 'hours'}
              </span>
            </div>
            <input
              id="duration-slider"
              type="range"
              min={MIN_DURATION_HOURS}
              max={MAX_DURATION_HOURS}
              step={1}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
              <span>{MIN_DURATION_HOURS}h</span>
              <span>{MAX_DURATION_HOURS}h</span>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="power-slider" className="text-xs font-semibold text-slate-700">
                Power Draw
              </label>
              <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {powerMw} MW
              </span>
            </div>
            <input
              id="power-slider"
              type="range"
              min={MIN_POWER_MW}
              max={MAX_POWER_MW}
              step={1}
              value={powerMw}
              onChange={(e) => setPowerMw(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
              <span>{MIN_POWER_MW} MW</span>
              <span>{MAX_POWER_MW} MW</span>
            </div>
          </div>
        </section>

        <PriceBarChart
          prices={curve.prices}
          startHour={result.startHour}
          endHour={result.endHour}
          powerMw={powerMw}
        />
      </div>
    </div>
  )
}
