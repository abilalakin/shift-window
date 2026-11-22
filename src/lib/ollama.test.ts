import { describe, expect, it, vi } from 'vitest'
import { PRICE_CURVES, findOptimalWindow } from './shiftWindow'
import {
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_QUESTION,
  askOllama,
  buildShiftPrompt,
} from './ollama'

describe('buildShiftPrompt', () => {
  it('includes the active curve, sliders, result metrics, and all 24 hourly prices', () => {
    const curve = PRICE_CURVES['sunny-weekday']
    const result = findOptimalWindow(curve.prices, 4, 5)
    const prompt = buildShiftPrompt(
      { curve, durationHours: 4, powerMw: 5, result },
      'Why is midday negative?',
    )

    expect(prompt).toContain('Sunny Weekday')
    expect(prompt).toContain('4 hours')
    expect(prompt).toContain('5 MW')
    expect(prompt).toContain('12:00 - 16:00')
    expect(prompt).toContain('-€350')
    expect(prompt).toContain('€1,170')
    expect(prompt).toContain('13:00: -28')
    expect(prompt).toContain('23:00: 74')
    expect(prompt).toContain('Why is midday negative?')
  })

  it('falls back to the default question when input is blank', () => {
    const curve = PRICE_CURVES['winter-peak']
    const result = findOptimalWindow(curve.prices, 4, 5)
    const prompt = buildShiftPrompt(
      { curve, durationHours: 4, powerMw: 5, result },
      '   ',
    )

    expect(prompt).toContain(DEFAULT_QUESTION)
  })
})

describe('askOllama', () => {
  it('sends the prompt to Ollama and returns the trimmed response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: '  Midday solar drops prices below zero.  ' }),
    })

    const answer = await askOllama({
      prompt: 'Explain this window',
      model: DEFAULT_OLLAMA_MODEL,
      fetchFn: fakeFetch,
    })

    expect(answer).toBe('Midday solar drops prices below zero.')
    expect(fakeFetch).toHaveBeenCalledWith(
      '/api/ollama/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const body = JSON.parse(fakeFetch.mock.calls[0][1].body)
    expect(body).toEqual({
      model: DEFAULT_OLLAMA_MODEL,
      prompt: 'Explain this window',
      stream: false,
    })
  })

  it('throws a clear error when Ollama returns a non-OK status', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'model not found',
    })

    await expect(
      askOllama({ prompt: 'Hi', model: 'missing:model', fetchFn: fakeFetch }),
    ).rejects.toThrow(/404/)
  })

  it('throws a helpful error when Ollama is unreachable', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      askOllama({ prompt: 'Hi', fetchFn: fakeFetch }),
    ).rejects.toThrow(/Ollama/)
  })
})
