import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const LOCAL_DEMO_MODE = import.meta.env.VITE_LOCAL_DEMO_MODE === 'true';
const ADMIN_EMAIL = 'topinfo93@gmail.com';
const leagues = [
    { code: 'PL', name: 'Premier League', country: 'England', flag: '🏴' },
    { code: 'PD', name: 'La Liga', country: 'Spain', flag: '🇪🇸' },
    { code: 'BL1', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪' },
    { code: 'SA', name: 'Serie A', country: 'Italy', flag: '🇮🇹' },
    { code: 'FL1', name: 'Ligue 1', country: 'France', flag: '🇫🇷' },
    { code: 'CL', name: 'Champions League', country: 'Europe', flag: '✦' },
];
type Team = { id: number; name: string; shortName?: string };
type Match = {
    id: number;
    utcDate: string;
    status: string;
    competition?: { code: string; name: string };
    competitionCode?: string;
    homeTeam: Team;
    awayTeam: Team;
    homeScore?: number | null;
    awayScore?: number | null;
};
type Article = {
    id: string;
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    isSample: boolean;
    status: string;
    publishedAt?: string;
};
type Standing = {
    position: number;
    team: Team;
    playedGames: number;
    won: number;
    draw: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
};
type Envelope<T> = {
    data?: T;
    matches?: Match[];
    standings?: Standing[];
    competition?: { name: string; seasonYear?: number };
    sync?:
        | { status: string; fetchedAt?: string | null; error?: string | null }
        | Array<{
              competition: string;
              status: string;
              fetchedAt?: string;
              error?: string;
          }>;
};

async function api<T>(
    path: string,
    token?: string,
    init?: RequestInit
): Promise<T> {
    const response = await fetch(`${API}/v1${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init?.headers,
        },
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(
            'The API did not return JSON. Check the backend URL configuration.'
        );
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(
            body.message || `Could not load data (${response.status}).`
        );
    }
    return (
        body && typeof body === 'object' && 'data' in body ? body.data : body
    ) as T;
}
function localDate(date: string) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(date));
}
function localTime(date: string) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date));
}
function statusText(status: string) {
    return (
        (
            {
                IN_PLAY: 'Live',
                PAUSED: 'Half-time',
                FINISHED: 'Full-time',
                POSTPONED: 'Postponed',
                SUSPENDED: 'Suspended',
                CANCELLED: 'Cancelled',
                TIMED: 'Upcoming',
                SCHEDULED: 'Upcoming',
            } as Record<string, string>
        )[status] || status
    );
}
function usePath() {
    const [path, setPath] = useState(location.pathname);
    useEffect(() => {
        const onPop = () => setPath(location.pathname);
        addEventListener('popstate', onPop);
        return () => removeEventListener('popstate', onPop);
    }, []);
    return [
        path,
        (next: string) => {
            history.pushState({}, '', next);
            setPath(next);
            scrollTo(0, 0);
        },
    ] as const;
}
function Link({
    to,
    navigate,
    children,
    className = '',
}: {
    to: string;
    navigate: (path: string) => void;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <a
            className={className}
            href={to}
            onClick={e => {
                if (e.metaKey || e.ctrlKey || e.button === 1) return;
                e.preventDefault();
                navigate(to);
            }}
        >
            {children}
        </a>
    );
}
function StateNote({ sync }: { sync?: Envelope<unknown>['sync'] }) {
    const list = Array.isArray(sync) ? sync : sync ? [sync] : [];
    const freshest = list
        .map(item => item.fetchedAt)
        .filter(Boolean)
        .sort()
        .at(-1);
    const errors = list.filter(item => item.status === 'ERROR');
    if (!list.length || list.every(item => item.status === 'PENDING'))
        return (
            <p className="state-note">
                Waiting for the first data sync from football-data.org…
            </p>
        );
    const stale = freshest
        ? Date.now() - new Date(freshest).getTime() > 6 * 60 * 60_000
        : false;
    return (
        <p className={`state-note ${errors.length || stale ? 'warn' : ''}`}>
            {errors.length
                ? 'Some competitions could not be refreshed. Showing the latest available data.'
                : stale
                  ? 'Data may be out of date. Showing the latest sync, not live scores.'
                  : 'Source: football-data.org'}
            {freshest
                ? ` · Updated ${localDate(freshest)} ${localTime(freshest)} (Bangkok)`
                : ''}
        </p>
    );
}
function TeamName({ team }: { team?: Team }) {
    const name = team?.shortName || team?.name || '—';
    const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase();
    return (
        <span className="team-name">
            <span className="crest-placeholder">{initials || '•'}</span>
            <span>{name}</span>
        </span>
    );
}
function MatchCard({
    match,
    navigate,
}: {
    match: Match;
    navigate: (path: string) => void;
}) {
    const done = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(match.status);
    const code = match.competition?.code || match.competitionCode || '';
    return (
        <button
            className="match-row"
            onClick={() => navigate(`/matches/${match.id}`)}
        >
            <div className="match-meta">
                <span>{localTime(match.utcDate)}</span>
                <span>
                    {match.competition?.name ||
                        leagues.find(x => x.code === code)?.name ||
                        code}
                </span>
            </div>
            <div className="match-teams">
                <TeamName team={match.homeTeam} />
                <b className={done ? 'score' : 'kickoff'}>
                    {done
                        ? `${match.homeScore ?? '–'} : ${match.awayScore ?? '–'}`
                        : '— : —'}
                </b>
                <TeamName team={match.awayTeam} />
            </div>
            <span
                className={`match-status ${match.status === 'IN_PLAY' ? 'live' : ''}`}
            >
                {statusText(match.status)}
            </span>
        </button>
    );
}
function Header({ navigate }: { navigate: (path: string) => void }) {
    return (
        <header className="header">
            <div className="header-inner">
                <Link to="/" navigate={navigate} className="brand">
                    <span className="brand-mark">HG</span>
                    <span>
                        HOME GROUND<small>FOOTBALL EVERY DAY</small>
                    </span>
                </Link>
                <nav>
                    <Link to="/fixtures" navigate={navigate}>
                        Fixtures
                    </Link>
                    <Link to="/leagues/PL" navigate={navigate}>
                        Competitions
                    </Link>
                    <Link to="/news" navigate={navigate}>
                        News
                    </Link>
                </nav>
                <Link to="/admin" navigate={navigate} className="admin-link">
                    Admin <span>↗</span>
                </Link>
            </div>
        </header>
    );
}
function Footer({ navigate }: { navigate: (path: string) => void }) {
    return (
        <footer>
            <div className="footer-inner">
                <div className="brand footer-brand">
                    <span className="brand-mark">HG</span>
                    <span>
                        HOME GROUND<small>FOOTBALL EVERY DAY</small>
                    </span>
                </div>
                <p>European football fixtures, scores and league tables.</p>
                <span>Match data: football-data.org</span>
                <Link to="/admin" navigate={navigate}>
                    Editorial admin
                </Link>
            </div>
        </footer>
    );
}
function PageTitle({
    eyebrow,
    title,
    subtitle,
}: {
    eyebrow: string;
    title: string;
    subtitle: string;
}) {
    return (
        <div className="page-title">
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </div>
    );
}
function MatchSection({
    title,
    matches,
    navigate,
    empty,
}: {
    title: string;
    matches: Match[];
    navigate: (path: string) => void;
    empty: string;
}) {
    return (
        <section className="panel">
            <div className="panel-head">
                <div>
                    <span className="eyebrow">MATCHES</span>
                    <h2>{title}</h2>
                </div>
                <Link to="/fixtures" navigate={navigate}>
                    All fixtures <span>→</span>
                </Link>
            </div>
            {matches.length ? (
                matches.map(match => (
                    <MatchCard
                        key={match.id}
                        match={match}
                        navigate={navigate}
                    />
                ))
            ) : (
                <div className="empty">{empty}</div>
            )}
        </section>
    );
}
function Home({ navigate }: { navigate: (path: string) => void }) {
    const [payload, setPayload] = useState<Envelope<Match[]>>({});
    const [articles, setArticles] = useState<Article[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        Promise.all([
            api<Envelope<Match[]>>('/football/matches'),
            api<Article[]>('/articles'),
        ])
            .then(([m, a]) => {
                setPayload(m);
                setArticles(a);
            })
            .catch(e => setError(e.message));
    }, []);
    const all = payload.matches || [];
    const today = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Bangkok',
    });
    const todayMatches = all
        .filter(
            m =>
                new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Bangkok',
                }).format(new Date(m.utcDate)) === today
        )
        .slice(0, 5);
    const recent = all
        .filter(m => ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(m.status))
        .slice(-5)
        .reverse();
    return (
        <>
            <section className="hero">
                <div className="hero-pattern" />
                <div className="hero-copy">
                    <span className="eyebrow light">
                        SIX LEAGUES · UPDATED DAILY
                    </span>
                    <h1>
                        The pulse of
                        <br />
                        <em>European football.</em>
                    </h1>
                    <p>
                        Fixtures, scores and title races across six leading
                        leagues, all in one place.
                    </p>
                    <Link
                        to="/fixtures"
                        navigate={navigate}
                        className="button button-lime"
                    >
                        View fixtures <span>→</span>
                    </Link>
                </div>
                <div className="hero-orbit">
                    <div className="orb orb-one" />
                    <div className="orb orb-two" />
                    <div className="orb-ball">⚽</div>
                    <div className="orb-label">
                        90′<small>MINUTES OF PASSION</small>
                    </div>
                </div>
                <div className="hero-bottom">
                    <span>01 — 06</span>
                    <div />
                    <span>BIG MATCHES EVERY WEEK</span>
                </div>
            </section>
            {error && <div className="notice">{error}</div>}
            <StateNote sync={payload.sync} />
            <main className="content">
                <div className="content-grid">
                    <div className="main-column">
                        <MatchSection
                            title="Today"
                            matches={todayMatches}
                            navigate={navigate}
                            empty="No matches scheduled for today. Fixtures will appear when data is available."
                        />
                        <MatchSection
                            title="Recent results"
                            matches={recent}
                            navigate={navigate}
                            empty="No recent results are available."
                        />
                    </div>
                    <aside className="side-column">
                        <section className="panel league-panel">
                            <div className="panel-head">
                                <div>
                                    <span className="eyebrow">SIX LEAGUES</span>
                                    <h2>Choose a league</h2>
                                </div>
                            </div>
                            {leagues.map((league, i) => (
                                <Link
                                    key={league.code}
                                    className="league-row"
                                    to={`/leagues/${league.code}`}
                                    navigate={navigate}
                                >
                                    <span className="league-number">
                                        0{i + 1}
                                    </span>
                                    <span className="league-flag">
                                        {league.flag}
                                    </span>
                                    <span>
                                        <b>{league.name}</b>
                                        <small>{league.country}</small>
                                    </span>
                                    <span className="arrow">↗</span>
                                </Link>
                            ))}
                        </section>
                        <section className="quote-card">
                            <span className="eyebrow light">FROM THE TOUCHLINE</span>
                            <p>
                                “Football is more than 90 minutes. The story
                                begins long before the whistle.”
                            </p>
                            <span>— THE HOME GROUND SPIRIT</span>
                        </section>
                    </aside>
                </div>
                <section className="news-block">
                    <div className="panel-head">
                        <div>
                            <span className="eyebrow">FROM THE NEWSROOM</span>
                            <h2>Latest news</h2>
                        </div>
                        <Link to="/news" navigate={navigate}>
                            View all <span>→</span>
                        </Link>
                    </div>
                    <div className="news-grid">
                        {articles.slice(0, 3).map((article, i) => (
                            <Link
                                className="news-card"
                                key={article.id}
                                to={`/news/${article.slug}`}
                                navigate={navigate}
                            >
                                <span className="news-index">0{i + 1}</span>
                                <span className="news-tag">
                                    {article.isSample ? 'SAMPLE' : 'NEWS'}
                                </span>
                                <h3>{article.title}</h3>
                                <p>{article.excerpt}</p>
                                <span className="news-more">
                                    Read article ↗
                                </span>
                            </Link>
                        ))}
                        {!articles.length && (
                            <div className="empty">No published articles yet.</div>
                        )}
                    </div>
                </section>
            </main>
        </>
    );
}
function Schedule({ navigate }: { navigate: (path: string) => void }) {
    const [date, setDate] = useState(
        new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    );
    const [league, setLeague] = useState('');
    const [matches, setMatches] = useState<Match[]>([]);
    const [sync, setSync] = useState<Envelope<unknown>['sync']>();
    const [error, setError] = useState('');
    useEffect(() => {
        const start = new Date(`${date}T00:00:00+07:00`);
        const end = new Date(start.getTime() + 86400000);
        api<Envelope<Match[]>>(
            `/football/matches?from=${start.toISOString()}&to=${end.toISOString()}${league ? `&competition=${league}` : ''}`
        )
            .then(x => {
                setMatches(x.matches || []);
                setSync(x.sync);
                setError('');
            })
            .catch(e => setError(e.message));
    }, [date, league]);
    const upcoming = matches.filter(
        m => !['FINISHED', 'IN_PLAY', 'PAUSED'].includes(m.status)
    );
    const finished = matches.filter(m =>
        ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(m.status)
    );
    return (
        <main className="content page-content">
            <PageTitle
                eyebrow="FIXTURES & RESULTS"
                title="Fixtures"
                subtitle="Follow matches and results across six European football leagues."
            />
            <div className="filters">
                <label>
                    Match date
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                    />
                </label>
                <label>
                    League
                    <select
                        value={league}
                        onChange={e => setLeague(e.target.value)}
                    >
                        <option value="">All leagues</option>
                        {leagues.map(x => (
                            <option key={x.code} value={x.code}>
                                {x.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {error && <div className="notice">{error}</div>}
            <StateNote sync={sync} />
            <div className="content-grid schedule-grid">
                <div className="main-column">
                    <MatchSection
                        title="Upcoming"
                        matches={upcoming}
                        navigate={navigate}
                        empty="No upcoming matches on the selected date."
                    />
                    <MatchSection
                        title="Completed and live"
                        matches={finished}
                        navigate={navigate}
                        empty="No completed or live matches on this date."
                    />
                </div>
                <aside className="side-column">
                    <section className="panel">
                        <span className="eyebrow">QUICK FILTER</span>
                        <h2>Followed leagues</h2>
                        {leagues.map(item => (
                            <button
                                className={`filter-league ${league === item.code ? 'selected' : ''}`}
                                key={item.code}
                                onClick={() =>
                                    setLeague(
                                        league === item.code ? '' : item.code
                                    )
                                }
                            >
                                {item.flag}
                                <span>{item.name}</span>
                                <b>{league === item.code ? '✓' : '＋'}</b>
                            </button>
                        ))}
                    </section>
                </aside>
            </div>
        </main>
    );
}
function CompetitionPage({
    code,
    navigate,
}: {
    code: string;
    navigate: (path: string) => void;
}) {
    const item = leagues.find(x => x.code === code);
    const [payload, setPayload] = useState<Envelope<Match[]>>({});
    const [table, setTable] = useState<Standing[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        Promise.all([
            api<Envelope<Match[]>>(`/football/competitions/${code}`),
            api<Envelope<unknown>>(`/football/standings/${code}`),
        ])
            .then(([m, s]) => {
                setPayload(m);
                setTable(s.standings || []);
            })
            .catch(e => setError(e.message));
    }, [code]);
    return (
        <main className="content page-content">
            <PageTitle
                eyebrow={`LEAGUE · ${item?.country || 'EUROPE'}`}
                title={item?.name || 'League'}
                subtitle={`Fixtures, results and standings for ${item?.name || ''} in the ${payload.competition?.seasonYear || 'current'} season.`}
            />
            {error && <div className="notice">{error}</div>}
            <StateNote sync={payload.sync} />
            <div className="content-grid">
                <div className="main-column">
                    <MatchSection
                        title="Fixtures & results"
                        matches={payload.matches || []}
                        navigate={navigate}
                        empty="No matches have been returned for this league yet."
                    />
                </div>
                <aside className="side-column">
                    <section className="panel table-panel">
                        <div className="panel-head">
                            <div>
                                <span className="eyebrow">STANDINGS</span>
                                <h2>{item?.name}</h2>
                            </div>
                        </div>
                        {table.length ? (
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Team</th>
                                            <th>MP</th>
                                            <th>GD</th>
                                            <th>Pts</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {table.map(row => (
                                            <tr key={row.team.id}>
                                                <td>{row.position}</td>
                                                <td>
                                                    <TeamName team={row.team} />
                                                </td>
                                                <td>{row.playedGames}</td>
                                                <td>
                                                    {row.goalDifference > 0
                                                        ? `+${row.goalDifference}`
                                                        : row.goalDifference}
                                                </td>
                                                <td>
                                                    <b>{row.points}</b>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty">
                                Standings are not available yet or are still
                                syncing.
                            </div>
                        )}
                    </section>
                </aside>
            </div>
        </main>
    );
}
function MatchDetail({
    id,
    navigate,
}: {
    id: string;
    navigate: (path: string) => void;
}) {
    const [match, setMatch] = useState<Match | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        api<Match>(`/football/matches/${id}`)
            .then(setMatch)
            .catch(e => setError(e.message));
    }, [id]);
    return (
        <main className="content page-content">
            {error ? (
                <div className="notice">{error}</div>
            ) : match ? (
                <>
                    <PageTitle
                        eyebrow={match.competition?.name || 'MATCH DETAILS'}
                        title="Match details"
                        subtitle={`${localDate(match.utcDate)} · ${localTime(match.utcDate)} Bangkok time`}
                    />
                    <section className="match-detail panel">
                        <span className="match-status">
                            {statusText(match.status)}
                        </span>
                        <div className="detail-teams">
                            <TeamName team={match.homeTeam} />
                            <strong>
                                {match.homeScore ?? '—'} :{' '}
                                {match.awayScore ?? '—'}
                            </strong>
                            <TeamName team={match.awayTeam} />
                        </div>
                        <p>{match.competition?.name}</p>
                        <Link
                            to={`/leagues/${match.competition?.code || match.competitionCode}`}
                            navigate={navigate}
                        >
                            View league page →
                        </Link>
                    </section>
                </>
            ) : (
                <div className="empty">Loading match details…</div>
            )}
        </main>
    );
}
function News({
    slug,
    navigate,
}: {
    slug?: string;
    navigate: (path: string) => void;
}) {
    const [articles, setArticles] = useState<Article[]>([]);
    const [article, setArticle] = useState<Article | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        if (slug)
            api<Article>(`/articles/${slug}`)
                .then(setArticle)
                .catch(e => setError(e.message));
        else
            api<Article[]>('/articles')
                .then(setArticles)
                .catch(e => setError(e.message));
    }, [slug]);
    useEffect(() => {
        if (article) {
            document.title = `${article.title} | Home Ground`;
            document
                .querySelector('meta[name="description"]')
                ?.setAttribute('content', article.excerpt || article.title);
        }
    }, [article]);
    if (slug)
        return (
            <main className="content page-content article-page">
                {error ? (
                    <div className="notice">{error}</div>
                ) : article ? (
                    <>
                        <span className="eyebrow">
                            {article.isSample ? 'SAMPLE' : 'FOOTBALL NEWS'}
                        </span>
                        <h1>{article.title}</h1>
                        <p className="article-excerpt">{article.excerpt}</p>
                        <div className="article-body">{article.content}</div>
                        <Link to="/news" navigate={navigate}>
                            ← Back to news
                        </Link>
                    </>
                ) : (
                    <div className="empty">Loading article…</div>
                )}
            </main>
        );
    return (
        <main className="content page-content">
            <PageTitle
                eyebrow="FOOTBALL NEWS"
                title="News"
                subtitle="Stories, perspectives and updates from across the leagues."
            />
            {error && <div className="notice">{error}</div>}
            <div className="news-grid news-list">
                {articles.map((item, i) => (
                    <Link
                        className="news-card"
                        key={item.id}
                        to={`/news/${item.slug}`}
                        navigate={navigate}
                    >
                        <span className="news-index">0{i + 1}</span>
                        <span className="news-tag">
                            {item.isSample ? 'SAMPLE' : 'NEWS'}
                        </span>
                        <h3>{item.title}</h3>
                        <p>{item.excerpt}</p>
                        <span className="news-more">Read article ↗</span>
                    </Link>
                ))}
                {!articles.length && !error && (
                    <div className="empty">No published articles yet.</div>
                )}
            </div>
        </main>
    );
}
function Admin() {
    const [token, setToken] = useState(
        sessionStorage.getItem('home-ground-admin-token') || ''
    );
    const [email, setEmail] = useState(ADMIN_EMAIL);
    const [password, setPassword] = useState('');
    const [items, setItems] = useState<Article[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        status: 'DRAFT',
    });
    const load = useCallback(async (auth: string) => {
        await api('/admin/session', auth);
        setItems(await api<Article[]>('/admin/articles', auth));
    }, []);
    useEffect(() => {
        const stored = sessionStorage.getItem('home-ground-admin-token');
        if (stored)
            load(stored).catch(e => {
                setError(e.message);
                sessionStorage.removeItem('home-ground-admin-token');
                setToken('');
            });
    }, [load]);
    async function login(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            if (email.toLowerCase() !== ADMIN_EMAIL)
                throw new Error(
                    'The CMS is restricted to the authorized administrator account.'
                );
            if (LOCAL_DEMO_MODE) {
                const result = await api<{ access_token: string }>(
                    '/admin/login',
                    undefined,
                    {
                        method: 'POST',
                        body: JSON.stringify({ email: ADMIN_EMAIL, password }),
                    }
                );
                await load(result.access_token);
                sessionStorage.setItem(
                    'home-ground-admin-token',
                    result.access_token
                );
                setToken(result.access_token);
                return;
            }
            if (!SUPABASE_URL || !SUPABASE_KEY)
                throw new Error('CMS sign-in is not configured.');
            const response = await fetch(
                `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: SUPABASE_KEY,
                    },
                    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
                }
            );
            const data = await response.json();
            if (!response.ok || !data.access_token)
                throw new Error(
                    data.msg ||
                        'Sign-in failed. Check the Supabase administrator account.'
                );
            await load(data.access_token);
            sessionStorage.setItem('home-ground-admin-token', data.access_token);
            setToken(data.access_token);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Sign-in failed.');
        } finally {
            setBusy(false);
        }
    }
    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!token) return;
        setBusy(true);
        setError('');
        try {
            await api(
                editingId ? `/admin/articles/${editingId}` : '/admin/articles',
                token,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    body: JSON.stringify(form),
                }
            );
            setForm({
                title: '',
                slug: '',
                excerpt: '',
                content: '',
                status: 'DRAFT',
            });
            setEditingId(null);
            setItems(await api<Article[]>('/admin/articles', token));
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Could not save the article.'
            );
        } finally {
            setBusy(false);
        }
    }
    function edit(item: Article) {
        setEditingId(item.id);
        setForm({
            title: item.title,
            slug: item.slug,
            excerpt: item.excerpt || '',
            content: item.content,
            status: item.status,
        });
        scrollTo({ top: 0, behavior: 'smooth' });
    }
    async function publish(item: Article) {
        try {
            await api(`/admin/articles/${item.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify({
                    status:
                        item.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED',
                }),
            });
            setItems(await api<Article[]>('/admin/articles', token));
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : 'Could not change the article status.'
            );
        }
    }
    async function remove(item: Article) {
        if (!confirm(`Delete “${item.title}”?`)) return;
        try {
            await api(`/admin/articles/${item.id}`, token, {
                method: 'DELETE',
            });
            setItems(await api<Article[]>('/admin/articles', token));
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Could not delete the article.'
            );
        }
    }
    return (
        <main className="content page-content">
            <PageTitle
                eyebrow="ADMIN AREA"
                title="Home Ground CMS"
                subtitle="Sign in to manage news articles and sync league data."
            />
            {error && <div className="notice">{error}</div>}
            {!token ? (
                <form className="panel login-card" onSubmit={login}>
                    <span className="eyebrow">ADMIN ONLY</span>
                    <h2>Editor sign-in</h2>
                    <p>Authorized administrator: {ADMIN_EMAIL}</p>
                    <label>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </label>
                    <button className="button button-dark" disabled={busy}>
                        {busy ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
            ) : (
                <div className="admin-grid">
                    <section className="panel">
                        <span className="eyebrow">ARTICLES</span>
                        <h2>{editingId ? 'Edit article' : 'Create article'}</h2>
                        <form className="admin-form" onSubmit={save}>
                            <label>
                                Title
                                <input
                                    required
                                    value={form.title}
                                    onChange={e =>
                                        setForm({
                                            ...form,
                                            title: e.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Slug
                                <input
                                    value={form.slug}
                                    placeholder="auto-generated-from-title"
                                    onChange={e =>
                                        setForm({
                                            ...form,
                                            slug: e.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Excerpt
                                <textarea
                                    rows={2}
                                    value={form.excerpt}
                                    onChange={e =>
                                        setForm({
                                            ...form,
                                            excerpt: e.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Content
                                <textarea
                                    required
                                    rows={8}
                                    value={form.content}
                                    onChange={e =>
                                        setForm({
                                            ...form,
                                            content: e.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Status
                                <select
                                    value={form.status}
                                    onChange={e =>
                                        setForm({
                                            ...form,
                                            status: e.target.value,
                                        })
                                    }
                                >
                                    <option value="DRAFT">Draft</option>
                                    <option value="PUBLISHED">Published</option>
                                </select>
                            </label>
                            <button
                                className="button button-dark"
                                disabled={busy}
                            >
                                {editingId ? 'Update article' : 'Save article'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => {
                                        setEditingId(null);
                                        setForm({
                                            title: '',
                                            slug: '',
                                            excerpt: '',
                                            content: '',
                                            status: 'DRAFT',
                                        });
                                    }}
                                >
                                    Cancel editing
                                </button>
                            )}
                        </form>
                    </section>
                    <section className="panel">
                        <div className="panel-head">
                            <div>
                                <span className="eyebrow">EDITOR</span>
                                <h2>Article list</h2>
                            </div>
                            <button
                                className="text-button"
                                onClick={() => {
                                    sessionStorage.removeItem(
                                        'home-ground-admin-token'
                                    );
                                    setToken('');
                                }}
                            >
                                Sign out
                            </button>
                        </div>
                        {items.map(item => (
                            <div className="admin-article" key={item.id}>
                                <div>
                                    <b>{item.title}</b>
                                    <small>
                                        {item.isSample ? 'Sample · ' : ''}
                                        {item.status}
                                    </small>
                                </div>
                                <button
                                    className="text-button"
                                    onClick={() => edit(item)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="text-button"
                                    onClick={() => void publish(item)}
                                >
                                    {item.status === 'PUBLISHED'
                                        ? 'Hide'
                                        : 'Publish'}
                                </button>
                                <button
                                    className="text-button danger"
                                    onClick={() => void remove(item)}
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                        {!items.length && (
                            <div className="empty">No articles yet.</div>
                        )}
                        <div className="sync-admin">
                            <span className="eyebrow">MATCH DATA</span>
                            <p>
                                Request a sync within the provider's free-tier
                                limits.
                            </p>
                            {leagues.map(item => (
                                <button
                                    key={item.code}
                                    className="text-button"
                                    onClick={async () => {
                                        try {
                                            await api(
                                                `/admin/sync/${item.code}`,
                                                token,
                                                { method: 'POST' }
                                            );
                                        } catch (e) {
                                            setError(
                                                e instanceof Error
                                                    ? e.message
                                                    : 'Sync failed.'
                                            );
                                        }
                                    }}
                                >
                                    ↻ {item.name}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}
function App() {
    const [path, navigate] = usePath();
    const route = useMemo(() => path.split('/').filter(Boolean), [path]);
    let page: React.ReactNode;
    if (path === '/') page = <Home navigate={navigate} />;
    else if (path === '/fixtures') page = <Schedule navigate={navigate} />;
    else if (path === '/news') page = <News navigate={navigate} />;
    else if (route[0] === 'news' && route[1])
        page = <News slug={route[1]} navigate={navigate} />;
    else if (route[0] === 'leagues' && route[1])
        page = (
            <CompetitionPage
                code={route[1].toUpperCase()}
                navigate={navigate}
            />
        );
    else if (route[0] === 'matches' && route[1])
        page = <MatchDetail id={route[1]} navigate={navigate} />;
    else if (path === '/admin') page = <Admin />;
    else
        page = (
            <main className="content page-content">
                <h1>Page not found</h1>
            </main>
        );
    return (
        <>
            <Header navigate={navigate} />
            {page}
            <Footer navigate={navigate} />
        </>
    );
}

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
