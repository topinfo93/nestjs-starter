import {
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from 'src/common/database/services/database.service';

const COMPETITIONS = [
    { code: 'PL', name: 'Premier League', area: 'England' },
    { code: 'PD', name: 'La Liga', area: 'Spain' },
    { code: 'BL1', name: 'Bundesliga', area: 'Germany' },
    { code: 'SA', name: 'Serie A', area: 'Italy' },
    { code: 'FL1', name: 'Ligue 1', area: 'France' },
    { code: 'CL', name: 'UEFA Champions League', area: 'Europe' },
] as const;

const MOCK_TEAMS = [
    { id: 1001, name: 'Manchester City', shortName: 'Man City', tla: 'MCI' },
    { id: 1002, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS' },
    { id: 1003, name: 'Real Madrid CF', shortName: 'Real Madrid', tla: 'RMA' },
    { id: 1004, name: 'FC Barcelona', shortName: 'Barcelona', tla: 'BAR' },
];

const mockMatches = () => {
    const now = new Date();
    return COMPETITIONS.flatMap((competition, index) => {
        const home = MOCK_TEAMS[index % MOCK_TEAMS.length];
        const away = MOCK_TEAMS[(index + 1) % MOCK_TEAMS.length];
        return [
            {
                id: 900000 + index * 2,
                competitionCode: competition.code,
                competition,
                utcDate: new Date(now.getTime() + 2 * 3600000).toISOString(),
                status: 'SCHEDULED',
                homeTeam: home,
                awayTeam: away,
                homeScore: null,
                awayScore: null,
            },
            {
                id: 900001 + index * 2,
                competitionCode: competition.code,
                competition,
                utcDate: new Date(now.getTime() - 3 * 3600000).toISOString(),
                status: 'FINISHED',
                homeTeam: away,
                awayTeam: home,
                homeScore: 2,
                awayScore: 1,
            },
        ];
    });
};

type ApiTeam = {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
};
type ApiMatch = {
    id: number;
    utcDate: string;
    status: string;
    matchday?: number;
    stage?: string;
    season?: { startDate?: string };
    lastUpdated?: string;
    homeTeam: ApiTeam;
    awayTeam: ApiTeam;
    score?: { fullTime?: { home?: number | null; away?: number | null } };
};

@Injectable()
export class FootballService {
    private readonly pending = new Map<string, Promise<unknown>>();
    private lastProviderRequest = 0;
    private queue = Promise.resolve();

    constructor(
        private readonly db: DatabaseService,
        private readonly config: ConfigService
    ) {}

    private get localDemoMode() {
        return (
            this.config.get<string>('LOCAL_DEMO_MODE') === 'true' &&
            this.config.get<string>('APP_ENV') === 'local' &&
            this.config.get<string>('NODE_ENV') !== 'production'
        );
    }

    async getCompetitions() {
        if (this.localDemoMode) {
            return COMPETITIONS.map(item => ({
                ...item,
                sync: { status: 'MOCK', fetchedAt: new Date().toISOString() },
            }));
        }
        const rows = await this.db.competition.findMany();
        const states = await this.db.syncState.findMany({
            where: { key: { startsWith: 'matches:' } },
        });
        const byCode = new Map(rows.map(row => [row.code, row]));
        const bySync = new Map(
            states.map(row => [row.key.slice('matches:'.length), row])
        );
        for (const item of COMPETITIONS) void this.syncCompetition(item.code);
        return COMPETITIONS.map(item => ({
            ...item,
            ...byCode.get(item.code),
            sync: bySync.get(item.code) ?? {
                status: 'PENDING',
                fetchedAt: null,
            },
        }));
    }

    async getCompetition(code: string) {
        this.assertCompetition(code);
        if (this.localDemoMode) {
            return {
                competition: COMPETITIONS.find(item => item.code === code),
                matches: mockMatches().filter(
                    match => match.competitionCode === code
                ),
                sync: { key: `matches:${code}`, status: 'MOCK' },
            };
        }
        void this.syncCompetition(code);
        const competition = await this.db.competition.findUnique({
            where: { code },
        });
        const matches = await this.db.match.findMany({
            where: { competitionCode: code },
            orderBy: { utcDate: 'asc' },
            take: 200,
            include: { homeTeam: true, awayTeam: true },
        });
        const sync = await this.db.syncState.findUnique({
            where: { key: `matches:${code}` },
        });
        return {
            competition:
                competition ?? COMPETITIONS.find(item => item.code === code),
            matches,
            sync,
        };
    }

    async getMatches(filters: {
        from?: string;
        to?: string;
        competition?: string;
    }) {
        if (this.localDemoMode) {
            const matches = mockMatches().filter(match => {
                const date = new Date(match.utcDate).getTime();
                const from = filters.from
                    ? Date.parse(filters.from)
                    : -Infinity;
                const to = filters.to ? Date.parse(filters.to) : Infinity;
                return (
                    (!filters.competition ||
                        match.competitionCode ===
                            filters.competition.toUpperCase()) &&
                    date >= from &&
                    date <= to
                );
            });
            return {
                matches,
                sync: COMPETITIONS.map(item => ({
                    competition: item.code,
                    status: 'MOCK',
                    fetchedAt: new Date().toISOString(),
                })),
            };
        }
        const now = new Date();
        const from =
            filters.from && !Number.isNaN(Date.parse(filters.from))
                ? new Date(filters.from)
                : new Date(now.getTime() - 7 * 86400000);
        const to =
            filters.to && !Number.isNaN(Date.parse(filters.to))
                ? new Date(filters.to)
                : new Date(now.getTime() + 30 * 86400000);
        if (filters.competition) {
            const code = filters.competition.toUpperCase();
            this.assertCompetition(code);
            void this.syncCompetition(code);
        } else {
            for (const item of COMPETITIONS)
                void this.syncCompetition(item.code);
        }
        const rows = await this.db.match.findMany({
            where: {
                utcDate: { gte: from, lte: to },
                ...(filters.competition
                    ? { competitionCode: filters.competition.toUpperCase() }
                    : {}),
            },
            orderBy: { utcDate: 'asc' },
            take: 500,
            include: { competition: true, homeTeam: true, awayTeam: true },
        });
        const states = await this.db.syncState.findMany({
            where: { key: { startsWith: 'matches:' } },
        });
        return {
            matches: rows,
            sync: states.map(state => ({
                competition: state.key.slice(8),
                status: state.status,
                fetchedAt: state.fetchedAt,
                error: state.error,
            })),
        };
    }

    async getMatch(id: number) {
        if (this.localDemoMode) {
            const match = mockMatches().find(item => item.id === id);
            if (!match) throw new NotFoundException('Match not found.');
            return match;
        }
        const match = await this.db.match.findUnique({
            where: { id },
            include: { competition: true, homeTeam: true, awayTeam: true },
        });
        if (!match) throw new NotFoundException('Match not found.');
        return match;
    }

    async getStandings(code: string) {
        this.assertCompetition(code);
        if (this.localDemoMode) {
            const teams = MOCK_TEAMS.slice(0, 4);
            return {
                competition: COMPETITIONS.find(item => item.code === code),
                standings: teams.map((team, index) => ({
                    position: index + 1,
                    team,
                    playedGames: 10,
                    won: 8 - index,
                    draw: index,
                    lost: 2,
                    points: 24 - index * 2,
                    goalsFor: 25 - index * 2,
                    goalsAgainst: 8 + index,
                    goalDifference: 17 - index * 3,
                })),
                sync: { key: `standings:${code}`, status: 'MOCK' },
            };
        }
        void this.syncStandings(code);
        const competition = await this.db.competition.findUnique({
            where: { code },
        });
        const year = competition?.seasonYear;
        const rows = year
            ? await this.db.standing.findMany({
                  where: { competitionCode: code, seasonYear: year },
                  orderBy: { position: 'asc' },
                  include: { team: true },
              })
            : [];
        const sync = await this.db.syncState.findUnique({
            where: { key: `standings:${code}` },
        });
        return {
            competition:
                competition ?? COMPETITIONS.find(item => item.code === code),
            standings: rows,
            sync,
        };
    }

    async syncCompetition(code: string, force = false) {
        this.assertCompetition(code);
        if (this.localDemoMode) {
            return {
                key: `matches:${code}`,
                status: 'MOCK',
                fetchedAt: new Date().toISOString(),
                forced: force,
            };
        }
        const key = `matches:${code}`;
        if (this.pending.has(key)) return this.pending.get(key);
        const previous = await this.db.syncState.findUnique({ where: { key } });
        if (
            !force &&
            previous?.fetchedAt &&
            Date.now() - previous.fetchedAt.getTime() < 15 * 60_000
        )
            return previous;
        const job = this.runQueued(() => this.fetchMatches(code));
        this.pending.set(key, job);
        try {
            return await job;
        } finally {
            this.pending.delete(key);
        }
    }

    private async syncStandings(code: string) {
        const key = `standings:${code}`;
        if (this.pending.has(key)) return this.pending.get(key);
        const previous = await this.db.syncState.findUnique({ where: { key } });
        if (
            previous?.fetchedAt &&
            Date.now() - previous.fetchedAt.getTime() < 6 * 60 * 60_000
        )
            return previous;
        const job = this.runQueued(() => this.fetchStandings(code));
        this.pending.set(key, job);
        try {
            return await job;
        } finally {
            this.pending.delete(key);
        }
    }

    private async runQueued<T>(task: () => Promise<T>): Promise<T> {
        const next = this.queue.then(async () => {
            const wait = Math.max(
                0,
                6500 - (Date.now() - this.lastProviderRequest)
            );
            if (wait) await new Promise(resolve => setTimeout(resolve, wait));
            this.lastProviderRequest = Date.now();
            return task();
        });
        this.queue = next.then(
            () => undefined,
            () => undefined
        );
        return next;
    }

    private async fetchMatches(code: string) {
        const now = new Date();
        const from = new Date(now.getTime() - 45 * 86400000)
            .toISOString()
            .slice(0, 10);
        const to = new Date(now.getTime() + 90 * 86400000)
            .toISOString()
            .slice(0, 10);
        try {
            const response = await this.provider(
                `/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`
            );
            const payload = (await response.json()) as {
                competition?: {
                    name?: string;
                    code?: string;
                    area?: { name?: string };
                    currentSeason?: { startDate?: string };
                };
                matches?: ApiMatch[];
            };
            const seasonYear = payload.competition?.currentSeason?.startDate
                ? Number(
                      payload.competition.currentSeason.startDate.slice(0, 4)
                  )
                : null;
            await this.db.competition.upsert({
                where: { code },
                create: {
                    code,
                    name:
                        payload.competition?.name ??
                        COMPETITIONS.find(item => item.code === code)!.name,
                    area: payload.competition?.area?.name,
                    seasonYear,
                },
                update: {
                    name:
                        payload.competition?.name ??
                        COMPETITIONS.find(item => item.code === code)!.name,
                    area: payload.competition?.area?.name,
                    seasonYear,
                },
            });
            for (const match of payload.matches ?? [])
                await this.storeMatch(code, match);
            return this.saveState(`matches:${code}`, 'OK', null);
        } catch (error) {
            return this.saveError(`matches:${code}`, error);
        }
    }

    private async fetchStandings(code: string) {
        try {
            const response = await this.provider(
                `/competitions/${code}/standings`
            );
            const payload = (await response.json()) as {
                competition?: {
                    name?: string;
                    currentSeason?: { startDate?: string };
                };
                standings?: Array<{
                    group?: string;
                    table?: Array<{
                        position: number;
                        playedGames: number;
                        won: number;
                        draw: number;
                        lost: number;
                        points: number;
                        goalsFor: number;
                        goalsAgainst: number;
                        goalDifference: number;
                        team: ApiTeam;
                    }>;
                }>;
            };
            if (!payload.standings?.length) {
                const message =
                    'The provider has not returned standings for this competition.';
                return this.db.syncState.upsert({
                    where: { key },
                    create: {
                        key,
                        status: 'UNAVAILABLE',
                        error: message,
                        lastAttempt: new Date(),
                    },
                    update: {
                        status: 'UNAVAILABLE',
                        error: message,
                        lastAttempt: new Date(),
                    },
                });
            }
            const seasonYear = payload.competition?.currentSeason?.startDate
                ? Number(
                      payload.competition.currentSeason.startDate.slice(0, 4)
                  )
                : new Date().getFullYear();
            await this.db.competition.upsert({
                where: { code },
                create: {
                    code,
                    name:
                        payload.competition?.name ??
                        COMPETITIONS.find(item => item.code === code)!.name,
                    seasonYear,
                },
                update: { seasonYear },
            });
            for (const group of payload.standings ?? [])
                for (const row of group.table ?? []) {
                    await this.storeTeam(row.team);
                    await this.db.standing.upsert({
                        where: {
                            competitionCode_seasonYear_teamId: {
                                competitionCode: code,
                                seasonYear,
                                teamId: row.team.id,
                            },
                        },
                        create: {
                            competitionCode: code,
                            seasonYear,
                            teamId: row.team.id,
                            position: row.position,
                            playedGames: row.playedGames,
                            won: row.won,
                            draw: row.draw,
                            lost: row.lost,
                            points: row.points,
                            goalsFor: row.goalsFor,
                            goalsAgainst: row.goalsAgainst,
                            goalDifference: row.goalDifference,
                            group: group.group,
                        },
                        update: {
                            position: row.position,
                            playedGames: row.playedGames,
                            won: row.won,
                            draw: row.draw,
                            lost: row.lost,
                            points: row.points,
                            goalsFor: row.goalsFor,
                            goalsAgainst: row.goalsAgainst,
                            goalDifference: row.goalDifference,
                            group: group.group,
                        },
                    });
                }
            return this.saveState(`standings:${code}`, 'OK', null);
        } catch (error) {
            return this.saveError(`standings:${code}`, error);
        }
    }

    private async storeMatch(code: string, match: ApiMatch) {
        await this.db.competition.upsert({
            where: { code },
            create: {
                code,
                name: COMPETITIONS.find(item => item.code === code)!.name,
            },
            update: {},
        });
        await this.storeTeam(match.homeTeam);
        await this.storeTeam(match.awayTeam);
        await this.db.match.upsert({
            where: { id: match.id },
            create: {
                id: match.id,
                competitionCode: code,
                seasonYear: match.season?.startDate
                    ? Number(match.season.startDate.slice(0, 4))
                    : null,
                utcDate: new Date(match.utcDate),
                status: match.status,
                matchday: match.matchday,
                stage: match.stage,
                homeTeamId: match.homeTeam.id,
                awayTeamId: match.awayTeam.id,
                homeScore: match.score?.fullTime?.home ?? null,
                awayScore: match.score?.fullTime?.away ?? null,
                lastUpdated: match.lastUpdated
                    ? new Date(match.lastUpdated)
                    : null,
            },
            update: {
                utcDate: new Date(match.utcDate),
                status: match.status,
                matchday: match.matchday,
                stage: match.stage,
                homeTeamId: match.homeTeam.id,
                awayTeamId: match.awayTeam.id,
                homeScore: match.score?.fullTime?.home ?? null,
                awayScore: match.score?.fullTime?.away ?? null,
                lastUpdated: match.lastUpdated
                    ? new Date(match.lastUpdated)
                    : null,
            },
        });
    }

    private async storeTeam(team: ApiTeam) {
        await this.db.team.upsert({
            where: { id: team.id },
            create: {
                id: team.id,
                name: team.name,
                shortName: team.shortName,
                tla: team.tla,
            },
            update: {
                name: team.name,
                shortName: team.shortName,
                tla: team.tla,
            },
        });
    }

    private async provider(path: string): Promise<Response> {
        const token = this.config.get<string>('FOOTBALL_DATA_API_TOKEN');
        if (!token)
            throw new ServiceUnavailableException(
                'The football data provider is not configured.'
            );
        for (let attempt = 0; attempt < 2; attempt++) {
            const response = await fetch(
                `https://api.football-data.org/v4${path}`,
                {
                    headers: { 'X-Auth-Token': token },
                    signal: AbortSignal.timeout(12000),
                }
            );
            if (response.ok) return response;
            if (
                attempt === 0 &&
                (response.status === 429 || response.status >= 500)
            ) {
                const retryAfter = Number(response.headers.get('retry-after'));
                const backoff =
                    Number.isFinite(retryAfter) && retryAfter > 0
                        ? Math.min(retryAfter * 1000, 60000)
                        : 7000;
                await new Promise(resolve => setTimeout(resolve, backoff));
                continue;
            }
            throw new Error(
                response.status === 403
                    ? 'The current API plan does not support this competition.'
                    : `football-data.org trả về HTTP ${response.status}.`
            );
        }
        throw new Error(
            'football-data.org did not return data after retrying.'
        );
    }

    private async saveState(key: string, status: string, error: string | null) {
        return this.db.syncState.upsert({
            where: { key },
            create: {
                key,
                status,
                error,
                fetchedAt: new Date(),
                lastAttempt: new Date(),
            },
            update: {
                status,
                error,
                fetchedAt: new Date(),
                lastAttempt: new Date(),
            },
        });
    }

    private async saveError(key: string, error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'Could not sync data from the provider.';
        return this.db.syncState.upsert({
            where: { key },
            create: {
                key,
                status: 'ERROR',
                error: message,
                lastAttempt: new Date(),
            },
            update: {
                status: 'ERROR',
                error: message,
                lastAttempt: new Date(),
            },
        });
    }

    private assertCompetition(code: string) {
        if (!COMPETITIONS.some(item => item.code === code))
            throw new NotFoundException('This competition is not supported.');
    }
}
