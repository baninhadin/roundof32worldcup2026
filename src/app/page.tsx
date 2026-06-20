'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

interface MatchLine {
  key: string;
  opp: string;
  flag: string | null;
  home: boolean;
  editable: boolean;
  /** Viewing team's goals / opponent's goals (null if not played or set). */
  gf: number | null;
  ga: number | null;
  result: 'W' | 'D' | 'L' | null;
  scoreText: string | null;
  date?: string;
}

type Overrides = Record<string, [number, number]>;

const matchKey = (groupName: string, home: string, away: string) => `${groupName}|${home}|${away}`;

// Web3Forms access key (safe to expose: it routes to the owner's inbox, not a secret).
const WEB3FORMS_KEY = 'f201a30d-ec98-425c-9328-87624d91cb54';

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

function matchesFor(group: Group, teamId: TeamId, editableKeys: Set<string>): MatchLine[] {
  return group.matches
    .filter((m) => m.home === teamId || m.away === teamId)
    .map((m) => {
      const home = m.home === teamId;
      const oppId = home ? m.away : m.home;
      const opp = group.teams.find((t) => t.id === oppId)!.name;
      const flag = flagClass(opp);
      const key = matchKey(group.name, m.home, m.away);
      const editable = editableKeys.has(key);
      const played = m.homeGoals !== null && m.awayGoals !== null;
      const gf = played ? ((home ? m.homeGoals : m.awayGoals) as number) : null;
      const ga = played ? ((home ? m.awayGoals : m.homeGoals) as number) : null;
      const result = played ? (gf! > ga! ? 'W' : gf! < ga! ? 'L' : 'D') : null;
      return {
        key,
        opp,
        flag,
        home,
        editable,
        gf,
        ga,
        result: result as 'W' | 'D' | 'L' | null,
        scoreText: played ? `${gf}-${ga}` : null,
        date: m.date,
      };
    });
}

/** Relative "updated X ago" label. The tick arg just forces periodic re-render. */
function agoText(d: Date | null, _tick: number): string {
  if (!d) return 'just now';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins <= 0) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return h === 1 ? '1 hr ago' : `${h} hr ago`;
}

// Accessibility for modals: move focus in on open, trap Tab, restore focus on close.
function useDialog<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !node) return;
      const items = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node?.addEventListener('keydown', onKey);
    return () => {
      node?.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, []);
  return ref;
}

// Email rendered only after mount, so the address is not in the static HTML scrapers read.
function EmailLink() {
  const [addr, setAddr] = useState('');
  useEffect(() => {
    setAddr(['baninhadin', 'gmail.com'].join('@'));
  }, []);
  if (!addr) return <span>email</span>;
  return <a href={`mailto:${addr}`}>{addr}</a>;
}

export default function Page() {
  const [data, setData] = useState<LoadResult>(() => bundledGroups());
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<TeamId | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [sim, setSim] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [tick, setTick] = useState(0);

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

  // Keep it as fresh as the source allows: re-fetch quietly while the tab is open,
  // and only replace the data when a live fetch actually succeeds.
  useEffect(() => {
    const refetch = setInterval(() => {
      loadGroups().then((r) => {
        if (r.source === 'live') setData(r);
      });
    }, 90_000);
    const clock = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      clearInterval(refetch);
      clearInterval(clock);
    };
  }, []);

  // Lightweight error alerting: email the owner on the first uncaught error per
  // session (capped, so a crash loop can't spam). Traffic is tracked by Vercel Analytics.
  useEffect(() => {
    let reported = false;
    const report = (detail: string) => {
      if (reported) return;
      reported = true;
      try {
        void fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            subject: 'ERROR — roundof32worldcup2026',
            from_name: 'Error reporter',
            message: `${detail}\n\nURL: ${location.href}\nUA: ${navigator.userAgent}`,
          }),
        });
      } catch {
        /* ignore */
      }
    };
    const onErr = (e: ErrorEvent) => report(`${e.message}\n${e.error?.stack ?? ''}`);
    const onRej = (e: PromiseRejectionEvent) => report(`Unhandled rejection: ${String(e.reason)}`);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelId(null);
        setRulesOpen(false);
        setHowOpen(false);
        setSuggestOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Matches that can be edited in simulate mode: the ones not yet played for real.
  const editableKeys = useMemo(() => {
    const s = new Set<string>();
    for (const g of data.groups)
      for (const m of g.matches)
        if (m.homeGoals === null) s.add(matchKey(g.name, m.home, m.away));
    return s;
  }, [data]);

  // Apply simulate overrides on top of the real data.
  const groups = useMemo(() => {
    if (Object.keys(overrides).length === 0) return data.groups;
    return data.groups.map((g) => ({
      ...g,
      matches: g.matches.map((m) => {
        const ov = overrides[matchKey(g.name, m.home, m.away)];
        return ov ? { ...m, homeGoals: ov[0], awayGoals: ov[1] } : m;
      }),
    }));
  }, [data, overrides]);

  const tournament = useMemo(() => classifyTournament(groups), [groups]);
  const verdictByTeam = useMemo(() => {
    const m = new Map<string, TeamVerdict>();
    for (const t of tournament) for (const v of t.verdicts) m.set(v.teamId, v);
    return m;
  }, [tournament]);
  const groupByTeam = useMemo(() => {
    const m = new Map<TeamId, Group>();
    for (const g of groups) for (const t of g.teams) m.set(t.id, g);
    return m;
  }, [groups]);

  const setScore = (key: string, homeGoals: number, awayGoals: number) =>
    setOverrides((o) => ({ ...o, [key]: [homeGoals, awayGoals] }));
  const clearScore = (key: string) =>
    setOverrides((o) => {
      const next = { ...o };
      delete next[key];
      return next;
    });
  const resetSim = () => setOverrides({});

  useEffect(() => {
    const open = selId !== null || rulesOpen || howOpen || suggestOpen;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selId, rulesOpen, howOpen, suggestOpen]);

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <span className="brand-badge" aria-hidden>
            <svg className="brand-svg" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#2ee6a0" />
                  <stop offset="1" stopColor="#7ef0c4" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="16" fill="url(#logoG)" />
              <path
                d="M14 33 l6 6 l13 -15"
                fill="none"
                stroke="#06150e"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.22"
              />
              <text
                x="32"
                y="46"
                textAnchor="middle"
                fontFamily="Segoe UI, Arial, sans-serif"
                fontSize="33"
                fontWeight="900"
                letterSpacing="-2"
                fill="#06150e"
              >
                32
              </text>
            </svg>
          </span>
          <h1 className="title">What does my team need to qualify?</h1>
        </div>
        <p className="subtitle">World Cup 2026, group stage to the Round of 32</p>
        <div className="bar">
          <span className="pill">
            <span className={`live-dot ${loading ? 'bundled' : data.source}`} />
            {loading
              ? 'Updating…'
              : data.source === 'live'
                ? `Live results · updated ${agoText(data.fetchedAt, tick)}`
                : 'Saved data (offline)'}
          </span>
          <button className="pill btn" onClick={() => setHowOpen(true)}>
            How it works
          </button>
          <button className="pill btn" onClick={() => setRulesOpen(true)}>
            Tiebreaker rules
          </button>
          <button
            className={`pill btn ${sim ? 'on' : ''}`}
            onClick={() => setSim((s) => !s)}
            aria-pressed={sim}
          >
            ⚙ Simulate {sim ? 'on' : 'off'}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {sim && (
        <div className="sim-banner">
          <span>
            <b>Simulate mode.</b> Open a team and set scores on its upcoming matches to see how the
            table and verdicts change. Also handy for entering a live score yourself.
          </span>
          <button className="sim-reset" onClick={resetSim} disabled={Object.keys(overrides).length === 0}>
            Reset {Object.keys(overrides).length > 0 ? `(${Object.keys(overrides).length})` : ''}
          </button>
        </div>
      )}

      <div className="legend">
        <span className="sw">
          <span className="chip" style={{ background: 'var(--green)' }} /> Qualified
        </span>
        <span className="sw">
          <span className="chip" style={{ background: 'var(--amber)' }} /> In contention
        </span>
        <span className="sw">
          <span className="chip" style={{ background: 'var(--red)' }} /> Eliminated
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
                        onClick={() => setSelId(r.teamId)}
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
          A calculator at heart. It runs every remaining result combination and returns the conclusion
          per team, and Simulate mode lets you set your own results to see what changes. &quot;Goal
          difference decides&quot; cases are real, they depend on margins not yet played. Tiebreakers
          follow the 2026 rules (head to head ahead of goal difference). The dashed line marks the top
          two cutoff.
        </p>
        <p>
          Unofficial and not affiliated with FIFA. Built for fun, not betting. Results from{' '}
          <a href="https://github.com/openfootball/worldcup.json" target="_blank" rel="noreferrer">
            openfootball/worldcup.json
          </a>{' '}
          (as live as that community source).
        </p>
      </footer>

      {selId &&
        (() => {
          const v = verdictByTeam.get(selId);
          const g = groupByTeam.get(selId);
          if (!v || !g) return null;
          const row = standingsView(g).find((x) => x.teamId === selId)!;
          return (
            <TeamModal
              v={v}
              r={row}
              upcoming={upcomingFor(g, selId)}
              matches={matchesFor(g, selId, editableKeys)}
              sim={sim}
              onSetScore={setScore}
              onClearScore={clearScore}
              onClose={() => setSelId(null)}
            />
          );
        })()}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {howOpen && <HowModal onClose={() => setHowOpen(false)} />}
      {suggestOpen && <SuggestModal onClose={() => setSuggestOpen(false)} />}

      {!suggestOpen && (
        <button className="fab" onClick={() => setSuggestOpen(true)} aria-label="Send feedback">
          <span className="fab-icon" aria-hidden>
            💬
          </span>
          <span className="fab-label">Feedback</span>
        </button>
      )}
    </div>
  );
}

interface TeamModalProps {
  v: TeamVerdict;
  r: StandingsRow;
  upcoming: NextMatch[];
  matches: MatchLine[];
  sim: boolean;
  onSetScore: (key: string, home: number, away: number) => void;
  onClearScore: (key: string) => void;
  onClose: () => void;
}

function TeamModal({ v, r, upcoming, matches, sim, onSetScore, onClearScore, onClose }: TeamModalProps) {
  const [showMatches, setShowMatches] = useState(sim);
  const dialogRef = useDialog<HTMLDivElement>();
  const flag = flagClass(v.teamName);
  const statusLabel =
    v.status === 'qualified' ? 'Qualified' : v.status === 'eliminated' ? 'Eliminated' : 'In contention';

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${v.teamName} qualification verdict`}
      >
        <div className="modal-top">
          {flag && <span className={`flag-lg ${flag}`} />}
          <div>
            <h3>{v.teamName}</h3>
            <div className="grp">Group {v.groupName}, currently {ordinalWord(r.position)}</div>
            {upcoming.map((u, i) => (
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

        <div
          className="stats-block"
          onClick={() => setShowMatches((s) => !s)}
          role="button"
          tabIndex={0}
        >
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
        </div>

        {showMatches && (
          <div className="matches">
            {matches.map((mt) => {
              const clamp = (n: number) => Math.max(0, Math.min(20, n || 0));
              const setGoals = (gf: number, ga: number) =>
                onSetScore(mt.key, mt.home ? gf : ga, mt.home ? ga : gf);
              const editing = sim && mt.editable;
              return (
                <div className="match" key={mt.key}>
                  <span className={`res ${mt.result ?? 'tbd'}`}>{mt.result ?? '–'}</span>
                  <span className="mteam">
                    {mt.flag && <span className={`flag ${mt.flag}`} />}
                    <span className="mside">{mt.home ? 'vs' : 'at'}</span> {mt.opp}
                  </span>
                  {editing ? (
                    <span className="medit">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={mt.gf ?? ''}
                        placeholder="0"
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setGoals(clamp(+e.target.value), mt.ga ?? 0)}
                      />
                      <span className="dash">-</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={mt.ga ?? ''}
                        placeholder="0"
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setGoals(mt.gf ?? 0, clamp(+e.target.value))}
                      />
                      {mt.gf !== null && (
                        <button className="mclear" onClick={() => onClearScore(mt.key)} aria-label="Clear">
                          ×
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="mscore">{mt.scoreText ?? (mt.date ? fmtDate(mt.date) : 'TBD')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
            If a goal difference path ends level on goals too, FIFA ranking decides it (tiebreaker 8).
            Fair play conduct (tiebreaker 7) needs card data the feed doesn&apos;t carry, so it&apos;s skipped.
          </div>
        )}
      </div>
    </div>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialog<HTMLDivElement>();
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal rules"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="How qualification works"
      >
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

function HowModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialog<HTMLDivElement>();
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal rules"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="How it works"
      >
        <div className="modal-top">
          <h3>How it works</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="how-lead">
          The whole thing is a pure function that runs in your browser, results and fixtures in, a
          verdict per team out. No backend, no database, no prediction model. Here is the pipeline.
        </p>

        <h4>1. Data</h4>
        <ul>
          <li>
            Fetches the public{' '}
            <a href="https://github.com/openfootball/worldcup.json" target="_blank" rel="noreferrer">
              openfootball/worldcup.json
            </a>{' '}
            feed client-side, with a bundled snapshot as an offline fallback.
          </li>
          <li>Parses the 104 fixtures into a group model. Unplayed games have null scores.</li>
        </ul>

        <h4>2. Rules (FIFA 2026, Article 13)</h4>
        <ul>
          <li>Rank by points, then head-to-head points, then H2H goal difference, then H2H goals.</li>
          <li>Then overall goal difference, overall goals, fair play, and FIFA ranking.</li>
          <li>Head-to-head sits ahead of goal difference, which is new for 2026.</li>
        </ul>

        <h4>3. The calculation</h4>
        <ul>
          <li>
            Enumerate every remaining result as win/draw/loss: 3^(games left), at most a few hundred
            combinations per group. This is finite and tiny, so we brute-force it.
          </li>
          <li>
            Points and head-to-head are exact from W/D/L, so &quot;qualified&quot; (top two in every
            combination) and &quot;eliminated&quot; come out exact.
          </li>
          <li>
            Goal difference is never enumerated. It is solved as an inequality: A finishes above B if
            A.gd + margin &gt; B.gd, so the answer is a threshold (&quot;win by 2 or more&quot;), or, when
            a draw freezes the gap, already decided.
          </li>
          <li>
            Best thirds: rank the twelve 3rd-placed teams across groups; the top 8 advance. Elimination
            uses group independence, so it stays tractable rather than enumerating all groups at once.
          </li>
        </ul>

        <h4>4. Trust</h4>
        <ul>
          <li>
            The engine is covered by unit tests, including an exhaustive run over 20,000 random
            finished groups and every Group A final scoreline, asserting exactly two qualify each time.
          </li>
          <li>Flip on Simulate to set your own scores. That is the only place anything is simulated.</li>
        </ul>
      </div>
    </div>
  );
}

function SuggestModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const dialogRef = useDialog<HTMLDivElement>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: 'Suggestion — roundof32worldcup2026',
          from_name: 'Site visitor',
          message,
          email: email || undefined,
        }),
      });
      const json = await res.json();
      setStatus(json.success ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal suggest"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Suggest an improvement"
      >
        <div className="modal-top">
          <h3>Suggest an improvement</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {status === 'sent' ? (
          <p className="suggest-thanks">Thanks, your message is on its way. Much appreciated.</p>
        ) : null}
        {status !== 'sent' && (
          <form onSubmit={submit}>
            <p className="suggest-lead">
              This page has plenty of flaws, so feel free to suggest anything that would make it better,
              what&apos;s confusing, broken, or missing.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your suggestion…"
              rows={5}
              required
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email (optional, so I can reply)"
            />
            <div className="suggest-row">
              <button type="submit" className="suggest-send" disabled={status === 'sending' || !message.trim()}>
                {status === 'sending' ? 'Sending…' : 'Send'}
              </button>
              {status === 'error' && <span className="suggest-err">Something went wrong, try again.</span>}
            </div>
          </form>
        )}
        <p className="suggest-direct">
          Prefer email? Write to <EmailLink />
        </p>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTheme(t === 'light' ? 'light' : 'dark');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('theming'); // enable a synced crossfade just for the switch
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    setTheme(next);
    window.setTimeout(() => root.classList.remove('theming'), 280);
  };
  return (
    <button className="pill btn icon" onClick={toggle} aria-label="Toggle light and dark theme">
      {theme === 'dark' ? '☀' : '☾'}
    </button>
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
