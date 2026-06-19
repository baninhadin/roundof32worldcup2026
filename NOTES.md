# Build notes — verified facts & the golden oracle

Local working notes (not the README). Captures the verification done before engine code so it
isn't re-litigated, and seeds the README's "AI got it wrong" + "what I assumed" sections.

## Tiebreaker order (2026) — status: multi-source corroborated, primary-source-pending

Within a group, rank teams level on points by:
1. Points (all group matches)
2. Head-to-head points (among only the tied teams)   ← NEW for 2026, ahead of overall GD
3. Head-to-head goal difference
4. Head-to-head goals scored
5. Overall goal difference
6. Overall goals scored
7. Fair-play / conduct score (YC -1, indirect red -3, direct red -4, YC+direct red -5)
8. FIFA World Ranking (drawing of lots REMOVED for 2026)

Best-thirds (cross-group): Points -> overall GD -> overall goals -> fair play -> FIFA ranking. Top 8 advance.

Verification: 6 independent secondary sources unanimous (SofaScore, NBC, Fox, ESPN, gamblingcalc,
worldcuplocaltime) + Wikipedia confirms the fair-play/H2H structure. FIFA's official page is
JS-rendered and returns empty to fetchers, so the primary doc was not directly read. Treat as
very-high-confidence. v1 computes criteria 1-6; 7-8 are disclaimed honestly when a tie survives 1-6.

## The "AI got it wrong, caught it" story (for the README)

Initial instinct (and the original HANDOFF.md golden example) used the 2018/2022 order: overall
goal difference FIRST. 2026 moved head-to-head to #2, AHEAD of goal difference. The wrong order
didn't just appear once — it survived into the hand-written test oracle (HANDOFF.md §10). Re-deriving
the 9 result-worlds by hand against the corrected rules caught it (see South Korea below).

## Golden oracle — Group A after Matchday 2 (REAL data, confirmed vs Wikipedia 2026-06-18)

Standings: Mexico 6 pts/+3, South Korea 3/0, Czechia 1/-1, South Africa 1/-2 (all played 2).
Key H2H: Czechia 1-1 South Africa (draw); South Korea 2-1 Czechia (SK beat CZE).
Final round (simultaneous, June 24): Czechia v Mexico, South Africa v South Korea.

CORRECTED expected verdicts (engine must reproduce these):

- **Mexico** — THROUGH (guaranteed; only the worst case of losing to Czechia leaves them on 6,
  which at most one other team can equal). Playing for top spot / seeding only.

- **South Korea** — Through with a WIN or a DRAW. A draw is enough: it leaves SK on 4, and the only
  team that can also reach 4 is Czechia (by beating Mexico), but SK beat Czechia head-to-head 2-1, and
  2026 ranks H2H above GD, so SK wins that tie regardless of Czechia's result. Only a LOSS drops SK to
  best-third hopes.
  >> HANDOFF.md §10 said "draw -> through only if Czechia don't beat Mexico." That is the 2022 logic
  >> and is WRONG for 2026. This is the concrete catch.

- **South Africa** — Must beat South Korea (draw or loss = out of top 2). Then:
  - if Czechia don't beat Mexico -> through in 2nd;
  - if Czechia also win -> level on points with Czechia; H2H was a 1-1 draw so it falls to overall GD
    (SA must out-do Czechia's margin: SA final GD > CZE final GD, i.e. win by ~2+ more than CZE win by);
  - else best-third backdoor only.

- **Czechia** — Must beat Mexico AND need South Korea to lose. If SK avoid defeat (win or draw) they
  take 2nd on H2H over Czechia, so Czechia is out even after beating Mexico. If both Czechia and SA win,
  they're level on points, H2H was a 1-1 draw, so overall GD decides (CZE must win by >= SA's margin).
  Else best-third backdoor only.
  >> HANDOFF.md §10 underspecified this (omitted the "need SK to lose" requirement). Completeness rule
  >> (cover every path) requires stating it.

## Product rules locked with Banin this session

- Live data: when a match finishes, recompute the table AND every verdict.
- Best-thirds computed for real across all 12 groups (not hand-waved).
- UI: one page, all 12 groups; definitely-qualified teams green/bordered; click a team -> readable
  headline + grouped conditions that still cover EVERY path (clarity AND completeness, nothing dropped).
- Card status vocabulary: plain text only, no fancy styling. Quiet factual words (Qualified / In
  contention / Eliminated) + plain-sentence verdict. ONE visual cue: green border on qualified; dim
  eliminated. Verdict detail shown as text on click.
- Naive 33/33/33 % garnish: SKIPPED for v1 but DO NOT forget it. Engine MUST compute per-world weights
  internally anyway, so adding the % later is a trivial addition, not a rewrite. Keep the door open.
- Deadline: ~40h remaining as of this session (2026-06-19). Build thoroughly.

## Stack decisions (this session)
- Next.js App Router + TypeScript, static export, Vercel.
- Vitest for unit tests; the corrected golden oracle becomes a real passing test.
- Live data: fetch openfootball worldcup.json client-side on load; bundled snapshot fallback so the
  demo never breaks. "Live" = as live as the (community-updated, possibly-lagging) source. Honest in README.
