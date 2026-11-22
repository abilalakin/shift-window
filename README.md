# ShiftWindow

A small web app that finds the cheapest hours of the day to run a high-power job using hourly German electricity prices (€/MWh).

**Live demo:** https://shift-window.vercel.app

## What it does

- Shows a 24-hour price chart (`00:00` to `23:00`) for two sample days:
  - **Sunny Weekday**: lots of solar power makes midday prices cheap or even negative.
  - **Winter Peak**: quiet overnight hours are cheap, while morning and evening peaks cost more.
- Lets you pick how long your job runs (`1–8 hours`) and how much power it uses (`1–10 MW`).
- Highlights the cheapest consecutive hours in green and compares the cost against starting at `09:00`.
- Includes an **Ask AI** panel (local dev only) that sends the current numbers to a local [Ollama](https://ollama.com/) model (`llama3.2:latest` by default).

## Run locally

```bash
npm install
npm run dev
```

## Test and build

```bash
npm test
npm run build
```
