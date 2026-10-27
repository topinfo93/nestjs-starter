import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const ADMIN_EMAIL = 'topinfo93@gmail.com';
const leagues = [
    { code: 'PL', name: 'Premier League', country: 'Anh', flag: '🏴' },
    { code: 'PD', name: 'La Liga', country: 'Tây Ban Nha', flag: '🇪🇸' },
    { code: 'BL1', name: 'Bundesliga', country: 'Đức', flag: '🇩🇪' },
    { code: 'SA', name: 'Serie A', country: 'Ý', flag: '🇮🇹' },
    { code: 'FL1', name: 'Ligue 1', country: 'Pháp', flag: '🇫🇷' },
    { code: 'CL', name: 'Champions League', country: 'Châu Âu', flag: '✦' },
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
        throw new Error('API không trả về dữ liệu JSON. Kiểm tra URL backend trên Vercel.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(
            body.message || `Không thể tải dữ liệu (${response.status}).`
        );
    }
    return (
        body && typeof body === 'object' && 'data' in body ? body.data : body
    ) as T;
}
function localDate(date: string) {
    return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(date));
}
function localTime(date: string) {
    return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date));
}
function statusText(status: string) {
    return (
        (
            {
                IN_PLAY: 'Đang đá',
                PAUSED: 'Nghỉ giữa hiệp',
                FINISHED: 'Kết thúc',
                POSTPONED: 'Hoãn',
                SUSPENDED: 'Tạm dừng',
                CANCELLED: 'Hủy',
                TIMED: 'Sắp diễn ra',
                SCHEDULED: 'Sắp diễn ra',
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
                Đang chờ lần đồng bộ đầu tiên từ football-data.org…
            </p>
        );
    const stale = freshest
        ? Date.now() - new Date(freshest).getTime() > 6 * 60 * 60_000
        : false;
    return (
        <p className={`state-note ${errors.length || stale ? 'warn' : ''}`}>
            {errors.length
                ? 'Một số giải hiện chưa lấy được dữ liệu; đang hiển thị lần cập nhật gần nhất nếu có.'
                : stale
                  ? 'Dữ liệu đã cũ; đang hiển thị lần đồng bộ gần nhất, không phải tỷ số trực tiếp.'
                  : 'Nguồn: football-data.org'}
            {freshest
                ? ` · Cập nhật ${localDate(freshest)} ${localTime(freshest)} (Bangkok)`
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
            onClick={() => navigate(`/tran-dau/${match.id}`)}
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
                    <span className="brand-mark">SN</span>
                    <span>
                        SÂN NHÀ<small>BÓNG ĐÁ MỖI NGÀY</small>
                    </span>
                </Link>
                <nav>
                    <Link to="/lich-thi-dau" navigate={navigate}>
                        Lịch thi đấu
                    </Link>
                    <Link to="/giai-dau/PL" navigate={navigate}>
                        Giải đấu
                    </Link>
                    <Link to="/tin-tuc" navigate={navigate}>
                        Tin tức
                    </Link>
                </nav>
                <Link to="/admin" navigate={navigate} className="admin-link">
                    Quản trị <span>↗</span>
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
                    <span className="brand-mark">SN</span>
                    <span>
                        SÂN NHÀ<small>BÓNG ĐÁ MỖI NGÀY</small>
                    </span>
                </div>
                <p>Lịch thi đấu, tỷ số và bảng xếp hạng bóng đá châu Âu.</p>
                <span>Dữ liệu trận đấu: football-data.org</span>
                <Link to="/admin" navigate={navigate}>
                    Quản trị biên tập
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
                    <span className="eyebrow">TRẬN ĐẤU</span>
                    <h2>{title}</h2>
                </div>
                <Link to="/lich-thi-dau" navigate={navigate}>
                    Tất cả lịch <span>→</span>
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
                        SÁU GIẢI ĐẤU · CẬP NHẬT MỖI NGÀY
                    </span>
                    <h1>
                        Nhịp đập
                        <br />
                        <em>sân cỏ châu Âu.</em>
                    </h1>
                    <p>
                        Lịch đấu, tỷ số và cuộc đua bảng xếp hạng của sáu giải
                        hàng đầu — tất cả trong một góc nhìn.
                    </p>
                    <Link
                        to="/lich-thi-dau"
                        navigate={navigate}
                        className="button button-lime"
                    >
                        Xem lịch thi đấu <span>→</span>
                    </Link>
                </div>
                <div className="hero-orbit">
                    <div className="orb orb-one" />
                    <div className="orb orb-two" />
                    <div className="orb-ball">⚽</div>
                    <div className="orb-label">
                        90′<small>PHÚT CỦA ĐAM MÊ</small>
                    </div>
                </div>
                <div className="hero-bottom">
                    <span>01 — 06</span>
                    <div />
                    <span>ĐẠI CHIẾN MỖI TUẦN</span>
                </div>
            </section>
            {error && <div className="notice">{error}</div>}
            <StateNote sync={payload.sync} />
            <main className="content">
                <div className="content-grid">
                    <div className="main-column">
                        <MatchSection
                            title="Hôm nay"
                            matches={todayMatches}
                            navigate={navigate}
                            empty="Chưa có trận nào trong khung giờ hôm nay. Dữ liệu sẽ hiện sau khi nguồn cập nhật."
                        />
                        <MatchSection
                            title="Kết quả gần đây"
                            matches={recent}
                            navigate={navigate}
                            empty="Chưa có kết quả gần đây từ nguồn dữ liệu."
                        />
                    </div>
                    <aside className="side-column">
                        <section className="panel league-panel">
                            <div className="panel-head">
                                <div>
                                    <span className="eyebrow">
                                        SÁU GIẢI ĐẤU
                                    </span>
                                    <h2>Chọn sân cỏ</h2>
                                </div>
                            </div>
                            {leagues.map((league, i) => (
                                <Link
                                    key={league.code}
                                    className="league-row"
                                    to={`/giai-dau/${league.code}`}
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
                            <span className="eyebrow light">GÓC SÂN NHÀ</span>
                            <p>
                                “Bóng đá không chỉ là 90 phút. Đó là câu chuyện
                                bắt đầu từ trước khi tiếng còi vang lên.”
                            </p>
                            <span>— TINH THẦN SÂN NHÀ</span>
                        </section>
                    </aside>
                </div>
                <section className="news-block">
                    <div className="panel-head">
                        <div>
                            <span className="eyebrow">TỪ PHÒNG BIÊN TẬP</span>
                            <h2>Tin mới nhất</h2>
                        </div>
                        <Link to="/tin-tuc" navigate={navigate}>
                            Xem tất cả <span>→</span>
                        </Link>
                    </div>
                    <div className="news-grid">
                        {articles.slice(0, 3).map((article, i) => (
                            <Link
                                className="news-card"
                                key={article.id}
                                to={`/tin-tuc/${article.slug}`}
                                navigate={navigate}
                            >
                                <span className="news-index">0{i + 1}</span>
                                <span className="news-tag">
                                    {article.isSample
                                        ? 'NỘI DUNG MẪU'
                                        : 'TIN TỨC'}
                                </span>
                                <h3>{article.title}</h3>
                                <p>{article.excerpt}</p>
                                <span className="news-more">
                                    Đọc bài viết ↗
                                </span>
                            </Link>
                        ))}
                        {!articles.length && (
                            <div className="empty">
                                Chưa có bài viết được xuất bản.
                            </div>
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
                title="Lịch thi đấu"
                subtitle="Theo dõi các trận cầu và kết quả từ sáu giải bóng đá châu Âu."
            />
            <div className="filters">
                <label>
                    Ngày thi đấu
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                    />
                </label>
                <label>
                    Giải đấu
                    <select
                        value={league}
                        onChange={e => setLeague(e.target.value)}
                    >
                        <option value="">Tất cả giải</option>
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
                        title="Sắp diễn ra"
                        matches={upcoming}
                        navigate={navigate}
                        empty="Không có trận sắp diễn ra trong ngày đã chọn."
                    />
                    <MatchSection
                        title="Đã và đang diễn ra"
                        matches={finished}
                        navigate={navigate}
                        empty="Chưa có trận đã kết thúc hoặc đang đá trong ngày này."
                    />
                </div>
                <aside className="side-column">
                    <section className="panel">
                        <span className="eyebrow">LỊCH NHANH</span>
                        <h2>Các giải theo dõi</h2>
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
                eyebrow={`GIẢI ĐẤU · ${item?.country || 'CHÂU ÂU'}`}
                title={item?.name || 'Giải đấu'}
                subtitle={`Lịch thi đấu, kết quả và bảng xếp hạng ${item?.name || ''} mùa ${payload.competition?.seasonYear || 'hiện tại'}.`}
            />
            {error && <div className="notice">{error}</div>}
            <StateNote sync={payload.sync} />
            <div className="content-grid">
                <div className="main-column">
                    <MatchSection
                        title="Lịch & kết quả"
                        matches={payload.matches || []}
                        navigate={navigate}
                        empty="Nguồn dữ liệu chưa trả về trận đấu cho giải này."
                    />
                </div>
                <aside className="side-column">
                    <section className="panel table-panel">
                        <div className="panel-head">
                            <div>
                                <span className="eyebrow">BẢNG XẾP HẠNG</span>
                                <h2>{item?.name}</h2>
                            </div>
                        </div>
                        {table.length ? (
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Đội</th>
                                            <th>Tr</th>
                                            <th>HS</th>
                                            <th>Đ</th>
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
                                Bảng xếp hạng chưa được nguồn cung cấp hoặc đang
                                đồng bộ.
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
                        eyebrow={match.competition?.name || 'CHI TIẾT TRẬN ĐẤU'}
                        title="Chi tiết trận đấu"
                        subtitle={`${localDate(match.utcDate)} · ${localTime(match.utcDate)} giờ Bangkok`}
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
                            to={`/giai-dau/${match.competition?.code || match.competitionCode}`}
                            navigate={navigate}
                        >
                            Xem trang giải đấu →
                        </Link>
                    </section>
                </>
            ) : (
                <div className="empty">Đang tải thông tin trận đấu…</div>
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
            document.title = `${article.title} | Sân Nhà`;
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
                            {article.isSample ? 'NỘI DUNG MẪU' : 'TIN SÂN CỎ'}
                        </span>
                        <h1>{article.title}</h1>
                        <p className="article-excerpt">{article.excerpt}</p>
                        <div className="article-body">{article.content}</div>
                        <Link to="/tin-tuc" navigate={navigate}>
                            ← Trở lại tin tức
                        </Link>
                    </>
                ) : (
                    <div className="empty">Đang tải bài viết…</div>
                )}
            </main>
        );
    return (
        <main className="content page-content">
            <PageTitle
                eyebrow="GÓC TIN SÂN CỎ"
                title="Tin tức"
                subtitle="Những câu chuyện, góc nhìn và nhịp sống quanh các giải đấu."
            />
            {error && <div className="notice">{error}</div>}
            <div className="news-grid news-list">
                {articles.map((item, i) => (
                    <Link
                        className="news-card"
                        key={item.id}
                        to={`/tin-tuc/${item.slug}`}
                        navigate={navigate}
                    >
                        <span className="news-index">0{i + 1}</span>
                        <span className="news-tag">
                            {item.isSample ? 'NỘI DUNG MẪU' : 'TIN TỨC'}
                        </span>
                        <h3>{item.title}</h3>
                        <p>{item.excerpt}</p>
                        <span className="news-more">Đọc bài viết ↗</span>
                    </Link>
                ))}
                {!articles.length && !error && (
                    <div className="empty">Chưa có bài viết được xuất bản.</div>
                )}
            </div>
        </main>
    );
}
function Admin() {
    const [token, setToken] = useState(
        sessionStorage.getItem('san-nha-admin-token') || ''
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
        const stored = sessionStorage.getItem('san-nha-admin-token');
        if (stored)
            load(stored).catch(e => {
                setError(e.message);
                sessionStorage.removeItem('san-nha-admin-token');
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
                    'CMS chỉ dành cho tài khoản quản trị viên đã được cấp quyền.'
                );
            if (!SUPABASE_URL || !SUPABASE_KEY)
                throw new Error('CMS chưa được cấu hình đăng nhập.');
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
                        'Đăng nhập không thành công. Kiểm tra tài khoản quản trị Supabase.'
                );
            await load(data.access_token);
            sessionStorage.setItem('san-nha-admin-token', data.access_token);
            setToken(data.access_token);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Đăng nhập thất bại.');
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
            setError(e instanceof Error ? e.message : 'Không thể lưu bài.');
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
                e instanceof Error ? e.message : 'Không thể đổi trạng thái.'
            );
        }
    }
    async function remove(item: Article) {
        if (!confirm(`Xóa “${item.title}”?`)) return;
        try {
            await api(`/admin/articles/${item.id}`, token, {
                method: 'DELETE',
            });
            setItems(await api<Article[]>('/admin/articles', token));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Không thể xóa bài.');
        }
    }
    return (
        <main className="content page-content">
            <PageTitle
                eyebrow="KHU VỰC RIÊNG TƯ"
                title="CMS Sân Nhà"
                subtitle="Đăng nhập quản trị để biên tập tin tức và đồng bộ dữ liệu giải đấu."
            />
            {error && <div className="notice">{error}</div>}
            {!token ? (
                <form className="panel login-card" onSubmit={login}>
                    <span className="eyebrow">CHỈ ADMIN</span>
                    <h2>Đăng nhập biên tập</h2>
                    <p>Tài khoản duy nhất được phép truy cập: {ADMIN_EMAIL}</p>
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
                        Mật khẩu
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </label>
                    <button className="button button-dark" disabled={busy}>
                        {busy ? 'Đang xác thực…' : 'Đăng nhập'}
                    </button>
                </form>
            ) : (
                <div className="admin-grid">
                    <section className="panel">
                        <span className="eyebrow">BÀI VIẾT</span>
                        <h2>{editingId ? 'Chỉnh sửa bài' : 'Tạo bài mới'}</h2>
                        <form className="admin-form" onSubmit={save}>
                            <label>
                                Tiêu đề
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
                                Đường dẫn
                                <input
                                    value={form.slug}
                                    placeholder="tu-dong-tao-tu-tieu-de"
                                    onChange={e =>
                                        setForm({
                                            ...form,
                                            slug: e.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Tóm tắt
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
                                Nội dung
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
                                Trạng thái
                                <select
                                    value={form.status}
                                    onChange={e =>
                                        setForm({
                                            ...form,
                                            status: e.target.value,
                                        })
                                    }
                                >
                                    <option value="DRAFT">Bản nháp</option>
                                    <option value="PUBLISHED">Xuất bản</option>
                                </select>
                            </label>
                            <button
                                className="button button-dark"
                                disabled={busy}
                            >
                                {editingId ? 'Cập nhật bài' : 'Lưu bài'}
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
                                    Hủy chỉnh sửa
                                </button>
                            )}
                        </form>
                    </section>
                    <section className="panel">
                        <div className="panel-head">
                            <div>
                                <span className="eyebrow">BIÊN TẬP</span>
                                <h2>Danh sách bài</h2>
                            </div>
                            <button
                                className="text-button"
                                onClick={() => {
                                    sessionStorage.removeItem(
                                        'san-nha-admin-token'
                                    );
                                    setToken('');
                                }}
                            >
                                Đăng xuất
                            </button>
                        </div>
                        {items.map(item => (
                            <div className="admin-article" key={item.id}>
                                <div>
                                    <b>{item.title}</b>
                                    <small>
                                        {item.isSample ? 'Nội dung mẫu · ' : ''}
                                        {item.status}
                                    </small>
                                </div>
                                <button
                                    className="text-button"
                                    onClick={() => edit(item)}
                                >
                                    Sửa
                                </button>
                                <button
                                    className="text-button"
                                    onClick={() => void publish(item)}
                                >
                                    {item.status === 'PUBLISHED'
                                        ? 'Ẩn bài'
                                        : 'Xuất bản'}
                                </button>
                                <button
                                    className="text-button danger"
                                    onClick={() => void remove(item)}
                                >
                                    Xóa
                                </button>
                            </div>
                        ))}
                        {!items.length && (
                            <div className="empty">Chưa có bài viết.</div>
                        )}
                        <div className="sync-admin">
                            <span className="eyebrow">DỮ LIỆU THI ĐẤU</span>
                            <p>
                                Yêu cầu đồng bộ theo giới hạn của nguồn miễn
                                phí.
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
                                                    : 'Đồng bộ không thành công.'
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
    else if (path === '/lich-thi-dau') page = <Schedule navigate={navigate} />;
    else if (path === '/tin-tuc') page = <News navigate={navigate} />;
    else if (route[0] === 'tin-tuc' && route[1])
        page = <News slug={route[1]} navigate={navigate} />;
    else if (route[0] === 'giai-dau' && route[1])
        page = (
            <CompetitionPage
                code={route[1].toUpperCase()}
                navigate={navigate}
            />
        );
    else if (route[0] === 'tran-dau' && route[1])
        page = <MatchDetail id={route[1]} navigate={navigate} />;
    else if (path === '/admin') page = <Admin />;
    else
        page = (
            <main className="content page-content">
                <h1>Không tìm thấy trang</h1>
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
