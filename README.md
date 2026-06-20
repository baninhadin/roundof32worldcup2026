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

## Who it's for, and the one job

Anyone following the group stage who wants a straight answer to "what does my team need today?". Fans,
group chats, broadcasters. The one job: turn the standings plus remaining fixtures into a single plain
verdict per team that still covers every path, without making you simulate anything.

## Why this problem

During a group stage the real question is conditional and fiddly to work out by hand: "we are through
if we win, or if we draw and the other game does not go a certain way, unless it comes down to goal
difference." Google shows the table but will not compute that. It is exactly the kind of bounded,
rule-heavy task software should just do for you, and it spikes every tournament.

## What is already out there, and why build it anyway

- Simulators (worldcuppass, worldcuppredictor, GoWoC, football-md): you enter scorelines, they redraw
  the table. The work is still yours.
- Predictors (Opta supercomputer): give a qualification percentage, not a condition.
- Editorial (FIFA permutations, ESPN clinching scenarios): prose you have to read and search.

This is a clarity play, not a new capability, and I would rather say so than oversell it. None of the
above gives a direct, per-team, plain verdict that is computed for you and still covers every path.

## Scope: in and out

**In:** exact top-two verdicts for all 12 groups under the 2026 tiebreakers (criteria 1 to 6), FIFA
ranking (criterion 8) as the final decider, mathematical elimination, a live best-thirds standing,
Simulate mode, light/dark, live data with an offline fallback.

**Out, on purpose:** fair-play conduct (criterion 7) needs per-match cards the feed does not carry, so a
tie that would reach it is decided by FIFA ranking instead, stated honestly. A real probability model is
deferred (a naive percentage would compete with the deterministic verdict). A fully conditional
best-thirds across all 12 groups at once is intractable, so that view is a clearly labelled live
snapshot while the top-two verdict stays exact.

## Where I did not have answers, and what I assumed

- The 2026 tiebreaker order is confirmed across several secondary sources (head-to-head moved ahead of
  goal difference, drawing of lots gone), but FIFA's own page is JavaScript-rendered and would not fetch,
  so I treat it as high-confidence rather than primary-source-verified, and the app links its sources.
- "Live" means as live as openfootball, which is community-maintained and can lag, hence the snapshot.

## Three questions I would ask a real user before building more

1. Do you check just your team, or compare a whole group at a glance? (Default view: one team or 12.)
2. Do you want the goal-difference maths spelled out numerically, or is "comes down to goal difference"
   enough?
3. Would a shareable one-line verdict be useful for group chats?

## How I would know it is working, and what is next

Working means the verdict for a real group matches what a careful person derives by hand. That is what
the Group A golden test pins down, and an exhaustive test brute-forces thousands of finished groups
asserting exactly two qualify each time. Next: spell out goal-difference thresholds numerically, add the
labelled probability figure, per-team share links, and source card data for criterion 7.

## Tech

Next.js (App Router) and TypeScript, deployed on Vercel. Engine is framework-free and unit-tested with
Vitest. Country flags via flag-icons. Traffic via Vercel Web Analytics.

## License

MIT. See [LICENSE](LICENSE).
