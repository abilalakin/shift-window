import {
  type OptimalWindowResult,
  type PriceCurve,
  formatEur,
  formatHour,
  formatWindowRange,
} from './shiftWindow'

export const DEFAULT_OLLAMA_MODEL = 'llama3.2:latest'
export const DEFAULT_QUESTION =
  'Explain this schedule and why it saves money in 3 short, plain sentences.'

export interface ShiftContext {
  curve: PriceCurve
  durationHours: number
  powerMw: number
  result: OptimalWindowResult
}

export interface AskOllamaOptions {
  prompt: string
  model?: string
  endpoint?: string
  signal?: AbortSignal
  fetchFn?: typeof fetch
}

export function buildShiftPrompt(context: ShiftContext, question: string): string {
  const { curve, durationHours, powerMw, result } = context
  const trimmedQuestion = question.trim() || DEFAULT_QUESTION
  const hourlyTable = curve.prices
    .map((price, hour) => `${formatHour(hour)}: ${price} €/MWh`)
    .join(', ')

  const savingsPct =
    result.savingsPercent === null ? 'n/a' : `${result.savingsPercent.toFixed(1)}%`

  return [
    'You are a concise energy assistant explaining a German hourly electricity schedule in plain language.',
    'Use only the numbers provided below. Keep your answer short and easy to read.',
    '',
    `Scenario: ${curve.label} (${curve.description})`,
    `Load: ${durationHours} hours at ${powerMw} MW (${durationHours * powerMw} MWh total)`,
    `Best window: ${formatWindowRange(result.startHour, result.endHour)}`,
    `Total cost: ${formatEur(result.totalCostEur)}`,
    `09:00 baseline cost: ${formatEur(result.baselineCostEur)}`,
    `Savings vs. 09:00 start: ${formatEur(result.savingsEur)} (${savingsPct})`,
    `Hourly prices (€/MWh): ${hourlyTable}`,
    '',
    `Question: ${trimmedQuestion}`,
  ].join('\n')
}

export async function askOllama({
  prompt,
  model = DEFAULT_OLLAMA_MODEL,
  endpoint = '/api/ollama/api/generate',
  signal,
  fetchFn = fetch,
}: AskOllamaOptions): Promise<string> {
  let response: Response
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    throw new Error('Could not reach local Ollama. Make sure Ollama is running on localhost:11434.')
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Ollama error (${response.status}): ${detail || 'request failed'}`)
  }

  const data = (await response.json()) as { response?: string }
  return (data.response ?? '').trim()
}
