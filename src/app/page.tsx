'use client';

import { useEffect, useMemo, useState } from 'react';
import { classifyTournament, type Group, type TeamId, type TeamVerdict } from '@/engine';
import { standingsView, type StandingsRow } from '@/lib/standingsView';
import { loadGroups, bundledGroups, type LoadResult } from '@/data/load';
import { flagClass } from '@/lib/flags';
import {
  FORMAT_RULES,
  GROUP_TIEBREAKERS,
  BEST_THIRD_TIEBREAKERS,
  RULE_SOURCES,
} from '@/lib/rules';

interface NextMatch {
  opp: string;
  date?: string;
}

interface Selection {
  verdict: TeamVerdict;
  row: StandingsRow;
  upcoming: NextMatch[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const [, mo, d] = iso.split('-').map(Number);
  const mon = MONTHS[(mo ?? 0) - 1];
  return d && mon ? `${d} ${mon}` : '';
}

function upcomingFor(group: Group, teamId: TeamId): NextMatch[] {
  return group.matches
    .filter((mt) => (mt.home === teamId || mt.away === teamId) && mt.homeGoals === null)
    .map((mt) => {
      const oppId = mt.home === teamId ? mt.away : mt.home;
      return { opp: group.teams.find((t) => t.id === oppId)!.name, date: mt.date };
    });
}

export default function Page() {
  const [data, setData] = useState<LoadResult>(() => bundledGroups());
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Selection | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSel(null);
        setRulesOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tournament = useMemo(() => classifyTournament(data.groups), [data]);
  const verdictByTeam = useMemo(() => {
    const m = new Map<string, TeamVerdict>();
    for (const t of tournament) for (const v of t.verdicts) m.set(v.teamId, v);
    return m;
  }, [tournament]);
  const upcomingByTeam = useMemo(() => {
    const m = new Map<string, NextMatch[]>();
    for (const g of data.groups) for (const t of g.teams) m.set(t.id, upcomingFor(g, t.id));
    return m;
  }, [data]);

  useEffect(() => {
    const open = sel !== null || rulesOpen;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sel, rulesOpen]);

  return (
    <div className="wrap">
      <header>
        <h1 className="title">What does my team need to qualify?</h1>
        <p className="subtitle">World Cup 2026, group stage to the Round of 32</p>
        <div className="bar">
          <span className="pill">
            <span className={`live-dot ${data.source}`} />
            {loading
              ? 'Checking live results…'
              : data.source === 'live'
                ? 'Live results'
                : 'Bundled snapshot'}
          </span>
          <button className="pill btn" onClick={() => setRulesOpen(true)}>
            ⓘ Tiebreaker rules and sources
          </button>
          <span className="pill">Top 2 + 8 best thirds advance</span>
        </div>
      </header>

      <div className="legend">
        <span className="sw">
          <span className="chip" style={{ background: 'var(--green)' }} /> Guaranteed through
        </span>
        <span className="sw">
          <span className="chip" style={{ background: 'var(--amber)' }} /> In contention
        </span>
        <span className="sw">Tap any team for exactly what it needs →</span>
      </div>

      <div className="grid">
        {tournament.map(({ group }, gi) => {
          const rows = standingsView(group);
          return (
            <section className="card" key={group.name} style={{ animationDelay: `${gi * 45}ms` }}>
              <div className="card-head">
                <span className="group-badge">{group.name}</span>
                <span className="grp-label">GROUP {group.name}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th className="team-col">Team</th>
                    <th>P</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>GD</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const v = verdictByTeam.get(r.teamId)!;
                    const flag = flagClass(r.teamName);
                    return (
                      <tr
                        key={r.teamId}
                        className={`${v.status} ${r.position === 2 ? 'cut-line' : ''}`}
                        onClick={() => setSel({ verdict: v, row: r, upcoming: upcomingByTeam.get(r.teamId) ?? [] })}
                      >
                        <td className="pos">{r.position}</td>
                        <td className="team-col">
                          <span className="team-cell">
                            {flag ? <span className={`flag ${flag}`} /> : <span className="flag" />}
                            {r.teamName}
                            {v.status === 'qualified' && <span className="qual-check">✓</span>}
                          </span>
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.drawn}</td>
                        <td>{r.lost}</td>
                        <td>{r.goalsFor}</td>
                        <td>{r.goalsAgainst}</td>
                        <td className={r.goalDiff > 0 ? 'gd-pos' : r.goalDiff < 0 ? 'gd-neg' : ''}>
                          {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                        </td>
                        <td className="pts">{r.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      <footer>
        <p>
          A calculator, not a simulator. It runs every remaining result combination and returns the
          conclusion per team. &quot;Goal difference decides&quot; cases are real, they depend on margins
          not yet played. Tiebreakers follow the 2026 rules (head to head ahead of goal difference). The
          dashed line marks the top two cutoff. Data from{' '}
          <a href="https://github.com/openfootball/worldcup.json" target="_blank" rel="noreferrer">
            openfootball/worldcup.json
          </a>
          , as live as that community source.
        </p>
      </footer>

      {sel && <TeamModal sel={sel} onClose={() => setSel(null)} />}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  );
}

function TeamModal({ sel, onClose }: { sel: Selection; onClose: () => void }) {
  const { verdict: v, row: r } = sel;
  const flag = flagClass(v.teamName);
  const statusLabel =
    v.status === 'qualified' ? 'Qualified' : v.status === 'eliminated' ? 'Eliminated' : 'In contention';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          {flag && <span className={`flag-lg ${flag}`} />}
          <div>
            <h3>{v.teamName}</h3>
            <div className="grp">Group {v.groupName}, currently {ordinalWord(r.position)}</div>
            {sel.upcoming.map((u, i) => (
              <div className="grp next" key={i}>
                {i === 0 ? 'Next up' : 'then'} {u.opp}
                {u.date ? `, ${fmtDate(u.date)}` : ''}
              </div>
            ))}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <span className={`status-pill ${v.status}`}>{statusLabel}</span>

        <table className="mini">
          <thead>
            <tr>
              <th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{r.played}</td>
              <td>{r.won}</td>
              <td>{r.drawn}</td>
              <td>{r.lost}</td>
              <td>{r.goalsFor}</td>
              <td>{r.goalsAgainst}</td>
              <td>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
              <td className="pts">{r.points}</td>
            </tr>
          </tbody>
        </table>

        <div className="headline-box">{v.headline}</div>

        <div className="conds-label">What each result means</div>
        {v.conditions.map((c, i) => {
          const tag = ['Win', 'Draw', 'Loss'].includes(c.outcome)
            ? c.outcome
            : c.guarantees
              ? 'good'
              : 'gen';
          return (
            <div className="cond" key={i}>
              <span className={`otag ${tag}`}>{c.outcome}</span>
              <div className={`ctext ${c.guarantees ? 'guar' : ''}`}>
                {c.lines.map((l, j) => (
                  <p className="cline" key={j}>
                    {l}
                  </p>
                ))}
                {c.note && <p className="cnote">{c.note}</p>}
              </div>
            </div>
          );
        })}

        {v.bestThird && (
          <div className={`third-box ${v.bestThird.currentlyIn ? 'in' : ''}`}>
            <b>Best third race.</b> Right now this team ranks{' '}
            <b>
              {v.bestThird.rank}
              {ordinalSuffix(v.bestThird.rank)} of 12
            </b>{' '}
            third placed teams. The top {v.bestThird.cutoff} advance, so on current results it{' '}
            <b>{v.bestThird.currentlyIn ? 'would qualify' : 'would miss out'}</b>.
          </div>
        )}

        {v.disclaimsDeepTiebreak && (
          <div className="disclaim">
            If a goal difference path also ends level on goals scored, it comes down to fair play conduct
            and FIFA ranking, which this version doesn&apos;t compute.
          </div>
        )}
      </div>
    </div>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal rules" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h3>How qualification works</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <h4>Format</h4>
        <ul>
          {FORMAT_RULES.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        <h4>Group tiebreakers (2026 order)</h4>
        <ol>
          {GROUP_TIEBREAKERS.map((t) => (
            <li key={t.n} className={t.v1 ? '' : 'future'}>
              {t.text}
              {!t.v1 && ' (not computed in this version)'}
            </li>
          ))}
        </ol>

        <h4>Best third placed teams</h4>
        <ol>
          {BEST_THIRD_TIEBREAKERS.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>

        <h4>Sources</h4>
        {RULE_SOURCES.map((s, i) => (
          <a className="src" key={i} href={s.url} target="_blank" rel="noreferrer">
            {s.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
function ordinalWord(n: number): string {
  return ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;
}
