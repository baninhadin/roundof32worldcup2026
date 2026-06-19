# What does my team need to qualify? — World Cup 2026

A plain-English **qualification calculator** for the 2026 World Cup group stage. Pick a team and
see, in one sentence, exactly what it needs to reach the Round of 32 — *"South Korea go through
with a win or a draw against South Africa."*

**Live demo:** https://roundof32worldcup2026.vercel.app

It is **not a simulator**. Simulators make you enter scorelines and read a table. This does the
opposite: it runs every remaining result combination itself and hands back the conclusion, per team.

---

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # the engine's unit tests, incl. the Group A golden case
npm run build    # production build
```

No API keys, no env vars, no database. The qualification math is pure client-side TypeScript.

---

## Who it's for, and the one job it does well

Anyone following the group stage who wants a straight answer to *"what does my team need tonight?"* —
fans, group chats, broadcasters. The one job: **turn the standings + remaining fixtures into a single
plain-English verdict per team**, covering every path, without making you simulate anything.

## Why this problem

During a group stage the question on everyone's mind is conditional and annoying to work out by hand:
*"We're through if we win; or if we draw and the other game doesn't go a certain way; unless it comes
down to goal difference…"* Google shows you the table but won't compute that. The mental arithmetic is
exactly the kind of bounded, rule-heavy problem software should just do for you.

How I know it's worth solving: every four years this is a recurring search-and-confusion spike, and the
existing tools (below) all stop one step short — they give you a table or a percentage, not the answer.

## What's already out there, and why build it anyway

Honest competitive picture — plenty exists:

- **Simulators** (worldcuppass, worldcuppredictor, GoWoC/worldcupcalculator, football-md): you enter
  scorelines, they redraw the table. The work is still yours.
- **Predictors** (Opta supercomputer): give a qualification **percentage**, not a condition.
- **Editorial** (FIFA's permutations page, ESPN's "clinching scenarios"): prose, but you have to read
  and find your team's case; not computed interactively.
- **gamblingcalc**: a dedicated best-thirds calculator — closest on that one sub-problem.

This is a **clarity wedge, not a new capability** — and I'd rather say that plainly than oversell it.
None of the above gives a direct, per-team, plain-English *"here's what you need"* that's computed for
you and still covers every path. That gap is the whole product.

## How the engine works ("chess engine, pruned")

The naive fear is that goal difference means infinite scorelines to simulate. It doesn't, if you split
the problem in two:

1. **Results (W/D/L) — finite and tiny.** In the final round a group has two simultaneous matches → 3×3
   = 9 "worlds"; earlier rounds are 3^(matches left), at most a few hundred. We enumerate these.
   Points and head-to-head **points** are fully determined by results, so *guaranteed-through* and
   *eliminated* verdicts come only from here — they're exact.
2. **Goal difference — never enumerated, solved as a threshold.** When teams tie on points and
   head-to-head, "does A finish above B" is just an inequality on goal difference. So GD only ever
   produces a **conditional** ("then goal difference decides"), never a false guarantee. Brazil 7–1
   isn't a scenario to simulate; it just satisfies "win by enough".

See `src/engine/` — it's a pure function, `(teams + fixtures) → per-team verdict`, with no UI or
network coupling.

## What's in scope, what I left out, and why

**In scope (v1):** exact top-two verdicts for all 12 groups under the full 2026 tiebreakers, criteria
1–6 (points, head-to-head points/GD/goals, overall GD/goals); a live best-thirds standing; live data
with an offline-proof fallback.

**Left out, on purpose:**
- **Tiebreaker criteria 7–8 (fair-play conduct, FIFA ranking).** Rarely reached, and they need data the
  results JSON doesn't carry. When a tie survives all of 1–6, the app says so honestly rather than
  guessing. Adding them later is a data-sourcing task, not an algorithm change.
- **A real probability model.** A naive "33/33/33" percentage falls out of the same enumeration for
  free, but it isn't a prediction and I didn't want it competing with the deterministic headline, so
  it's deferred. (The engine already computes the per-world weights it would need.)
- **Conditional best-thirds across all 12 groups.** A fully rigorous "you're guaranteed a best-third
  spot" would require enumerating every group at once (intractable). The top-two verdict stays exact;
  the best-thirds view is a clearly-labelled **live snapshot** ("as things stand, 5th of 12; top 8
  advance") — which is how ESPN and others present it too.

## Where I didn't have answers, and what I assumed

- **The 2026 tiebreaker order.** Confirmed against six independent secondary sources (SofaScore, NBC,
  Fox, ESPN, gamblingcalc, plus a football-data account), all unanimous: head-to-head moved ahead of
  overall goal difference for 2026, and drawing-of-lots is gone. FIFA's own regulations page is
  JavaScript-rendered and wouldn't fetch, so I could not read the primary PDF directly. I treat the
  order as very-high-confidence but primary-source-pending, and say so.
- **"Live" means as-live-as-the-source.** Data is openfootball/worldcup.json, community-maintained, so a
  just-finished result can lag by a while. A bundled snapshot guarantees the demo never shows empty.

## Three questions I'd ask a real user before building more

1. When you check this, are you asking about **your** team only, or comparing a whole group at a glance?
   (Decides whether the default view is one team or all 12.)
2. Do you actually want the **goal-difference math spelled out** ("win by 2+"), or is "it comes down to
   goal difference" enough? (Decides how deep the conditional copy goes.)
3. Would a **shareable one-line verdict** ("link me my team's situation") be useful for group chats?
   (Decides whether per-team deep links / share cards are worth it.)

## How I'd know it's working, and what's next

**Working** = the verdict for a real group matches what a careful human derives by hand. That's exactly
what the Group A golden test pins down (`src/engine/classify.test.ts`), and it's how I caught my own
biggest mistake (below). Next: spell out GD thresholds numerically, add the labelled probability
garnish, per-team share links, and source criteria 7–8 to remove the one disclaimer.

## AI usage — and one thing it got wrong that I caught

This was built with AI assistance (Claude Code) across research, the engine, and the UI.

The sharpest catch: **the tiebreaker order.** The first instinct was the 2018/2022 rule — *overall goal
difference first*. That's wrong for 2026, which moved head-to-head ahead of goal difference. Worse, the
wrong order didn't just appear once — it survived into the **hand-written test case** I was going to
trust as ground truth: the draft said South Korea, on a draw, would go through "only if Czechia don't
beat Mexico." Re-deriving all nine result-worlds against the *corrected* rules showed that's false:
South Korea beat Czechia head-to-head, and since 2026 ranks head-to-head above goal difference, **a draw
is enough no matter what Czechia do.** The fix is the single most load-bearing line in the app, and it's
exactly the assertion the golden test now locks in.

Lesson kept: verify the rules against a primary source *before* writing the oracle, because a wrong
oracle makes every test pass against the wrong answer.

## License

MIT — see [LICENSE](LICENSE).
