import { NotFoundException } from '@nestjs/common';

import { FootballService } from '../../src/modules/football/football.service';

describe('FootballService local demo mode', () => {
    const config = {
        get: (key: string) =>
            ({ LOCAL_DEMO_MODE: 'true', APP_ENV: 'local' })[key],
    };
    const service = new FootballService({} as never, config as never);

    it('returns the six supported competitions without a provider request', async () => {
        const competitions = await service.getCompetitions();
        expect(competitions).toHaveLength(6);
        expect(competitions[0]).toMatchObject({
            code: 'PL',
            sync: { status: 'MOCK' },
        });
    });

    it('returns mock scheduled and finished matches', async () => {
        const result = await service.getMatches({ competition: 'PL' });
        expect(result.matches).toHaveLength(2);
        expect(result.matches.map(match => match.status)).toEqual([
            'SCHEDULED',
            'FINISHED',
        ]);
        expect(result.sync[0].status).toBe('MOCK');
    });

    it('returns mock standings and validates match identifiers', async () => {
        const standings = await service.getStandings('PL');
        expect(standings.standings).toHaveLength(4);
        expect((await service.getMatch(900000)).status).toBe('SCHEDULED');
        await expect(service.getMatch(123)).rejects.toBeInstanceOf(
            NotFoundException
        );
    });

    it('does not contact the football provider when manually syncing', async () => {
        await expect(
            service.syncCompetition('PL', true)
        ).resolves.toMatchObject({ status: 'MOCK', forced: true });
    });
});
