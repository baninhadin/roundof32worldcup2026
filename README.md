# What does my team need to qualify?

A plain-English qualification calculator for the 2026 World Cup group stage. Pick a team and see, in
one short verdict, exactly what it needs to reach the Round of 32. For example: "South Korea, win or
draw vs South Africa."

**Live:** https://roundof32worldcup2026.vercel.app

It is a calculator, not a simulator. Simulators make you type in scorelines and read a table. This does
the opposite: it runs every remaining result combination itself and gives you the conclusion, per team.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine unit tests, incl. an exhaustive run over thousands of finished groups
npm run build    # production build
```

No API keys, no env vars, no database. The qualification maths is pure client-side TypeScript.

## What you can do

- See all 12 groups at a glance. Green = qualified, amber = in contention, red = eliminated.
- Tap any team for its verdict: what each result (win, draw, loss) means, the best-third picture, and
  why a qualified team is through.
- Tap a team's stats to see its three group matches (score if played, date if not).
- Flip on **Simulate** to set your own scorelines on upcoming games (or enter a live score) and watch
  the whole table and every verdict recompute.
- Light and dark themes. Live data with an offline fallback so the page never shows empty.

## How it works

The whole thing is a pure function in the browser: results and fixtures in, a verdict per team out.

1. **Data.** Fetches the public [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)
   feed client-side, with a bundled snapshot as an offline fallback. Parses the 104 fixtures into a
   group model; unplayed games have null scores.
2. **Rules (FIFA 2026, Article 13).** Points, then head-to-head points, then H2H goal difference, then
   H2H goals, then overall goal difference, overall goals, fair play, and FIFA ranking. Head-to-head
   sits ahead of goal difference, which is new for 2026.
3. **The calculation.** Enumerate every remaining result as win/draw/loss: 3^(games left), at most a few
   hundred per group, so it is brute-forced. Points and head-to-head are exact from W/D/L, so
   "qualified" (top two in every combination) and "eliminated" come out exact. Goal difference is never
   enumerated; it is solved as an inequality, so the answer is a threshold ("win by 2 or more") or,
   when a draw freezes the gap, already decided.
4. **Best thirds.** Rank the twelve 3rd-placed teams across groups; the top 8 advance. Elimination uses
   group independence so it stays tractable rather than enumerating all groups at once.

Fair-play conduct (criterion 7) needs per-match cards the data feed does not carry, so a tie that would
reach it is decided by FIFA ranking (criterion 8) instead, stated honestly in the app.

## Project layout

```
src/engine/   pure qualification engine (framework-free, unit-tested with Vitest)
src/data/     openfootball adapter + live loader with bundled snapshot fallback
src/lib/      flags, rules text, standings view helpers
src/app/      Next.js App Router UI (one page, modals, theme)
```

## Tech

Next.js (App Router) and TypeScript, deployed on Vercel. The engine is framework-free and unit-tested
with Vitest. Country flags via flag-icons. Traffic via Vercel Web Analytics.

## License

MIT. See [LICENSE](LICENSE).
