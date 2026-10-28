import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import { AdminAuthGuard } from '../../src/modules/admin/admin-auth.guard';

describe('AdminAuthGuard', () => {
    const config = {
        get: (key: string) =>
            ({
                SUPABASE_URL: 'https://example.supabase.co',
                SUPABASE_ANON_KEY: 'public-key',
                ADMIN_EMAIL: 'topinfo93@gmail.com',
            })[key],
    };
    const makeContext = (authorization?: string) =>
        ({
            switchToHttp: () => ({
                getRequest: () => ({ headers: { authorization } }),
            }),
        }) as unknown as ExecutionContext;

    afterEach(() => jest.restoreAllMocks());

    it('rejects a request without a bearer token', async () => {
        const guard = new AdminAuthGuard(config as never);
        await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
            UnauthorizedException
        );
    });

    it('accepts the local demo token only in local demo mode', async () => {
        const localConfig = {
            get: (key: string) =>
                ({
                    LOCAL_DEMO_MODE: 'true',
                    APP_ENV: 'local',
                    ADMIN_EMAIL: 'topinfo93@gmail.com',
                })[key],
        };
        const guard = new AdminAuthGuard(localConfig as never);
        await expect(
            guard.canActivate(
                makeContext('Bearer local-demo:topinfo93@gmail.com')
            )
        ).resolves.toBe(true);
        await expect(
            guard.canActivate(makeContext('Bearer arbitrary-token'))
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a valid session for the configured admin email', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({ email: 'topinfo93@gmail.com' }),
        } as Response);
        const guard = new AdminAuthGuard(config as never);
        await expect(
            guard.canActivate(makeContext('Bearer valid-token'))
        ).resolves.toBe(true);
    });

    it('rejects a valid session for another email', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({ email: 'reader@example.com' }),
        } as Response);
        const guard = new AdminAuthGuard(config as never);
        await expect(
            guard.canActivate(makeContext('Bearer valid-token'))
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });
});
