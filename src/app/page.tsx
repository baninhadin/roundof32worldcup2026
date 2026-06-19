'use client';

import { useEffect, useMemo, useState } from 'react';
import { classifyTournament, type TeamVerdict } from '@/engine';
import { standingsView } from '@/lib/standingsView';
import { loadGroups, bundledGroups, type LoadResult } from '@/data/load';

export default function Page() {
  const [data, setData] = useState<LoadResult>(() => bundledGroups());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadGroups().then((r) => {
      if (alive) {
        setData(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const tournament = useMemo(() => classifyTournament(data.groups), [data]);
  const verdictByTeam = useMemo(() => {
    const m = new Map<string, TeamVerdict>();
    for (const t of tournament) for (const v of t.verdicts) m.set(v.teamId, v);
    return m;
  }, [tournament]);

  return (
    <div className="wrap">
      <header>
        <h1>What does my team need to qualify?</h1>
        <p className="sub">World Cup 2026 · Group stage → Round of 32</p>
        <div className="meta">
          <span>
            <span className={`dot ${data.source}`} />{' '}
            {loading
              ? 'checking for live results…'
              : data.source === 'live'
                ? 'Live results (openfootball)'
                : 'Bundled snapshot (live fetch unavailable)'}
          </span>
          <span>·</span>
          <span>Top 2 of each group + 8 best third-placed teams advance</span>
        </div>
      </header>

      <div className="legend">
        <span className="swatch">
          <span className="bar" style={{ background: 'var(--green)' }} /> Guaranteed through
        </span>
        <span className="swatch">Tap any team for exactly what it needs</span>
      </div>

      <div className="grid">
        {tournament.map(({ group }) => {
          const rows = standingsView(group);
          return (
            <section className="card" key={group.name}>
              <h2>GROUP {group.name}</h2>
              {rows.map((r) => {
                const v = verdictByTeam.get(r.teamId)!;
                const isOpen = expanded === r.teamId;
                return (
                  <div key={r.teamId}>
                    <button
                      className={`row ${v.status} ${isOpen ? 'expanded' : ''}`}
                      onClick={() => setExpanded(isOpen ? null : r.teamId)}
                      aria-expanded={isOpen}
                    >
                      <span className="pos">{r.position}</span>
                      <span className="name">{r.teamName}</span>
                      <span className="nums">{r.played}p</span>
                      <span className="nums">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</span>
                      <span className="nums">{r.points}</span>
                    </button>
                    {isOpen && <Detail v={v} />}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <footer>
        <p>
          This is a calculator, not a simulator — it runs every remaining result combination and
          hands back the conclusion. &quot;Goal difference decides&quot; cases are genuine: they
          depend on margins not yet played. Tiebreakers follow the 2026 rules (head-to-head ahead of
          goal difference). Data:{' '}
          <a href="https://github.com/openfootball/worldcup.json" target="_blank" rel="noreferrer">
            openfootball/worldcup.json
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

function Detail({ v }: { v: TeamVerdict }) {
  return (
    <div className="detail">
      <div className="headline">{v.headline}</div>
      {v.conditions.map((c, i) => (
        <div className="cond" key={i}>
          <span className={`tag ${c.guarantees ? 'guar' : ''}`}>{c.outcome}</span>
          <span className="text">{c.detail}</span>
        </div>
      ))}
      {v.bestThird && (
        <div className={`third ${v.bestThird.currentlyIn ? 'in' : ''}`}>
          Best-third race (as things stand):{' '}
          <b>
            {v.bestThird.rank}
            {ordinal(v.bestThird.rank)} of 12
          </b>{' '}
          — top {v.bestThird.cutoff} advance, so currently{' '}
          <b>{v.bestThird.currentlyIn ? 'would qualify' : 'would miss out'}</b>.
        </div>
      )}
      {v.disclaimsDeepTiebreak && (
        <div className="third">
          Note: one path stays level even on goal difference — it would then be decided by fair-play
          conduct and FIFA ranking, which this v1 doesn&apos;t compute.
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
