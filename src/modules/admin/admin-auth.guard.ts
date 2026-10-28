import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AdminAuthGuard implements CanActivate {
    constructor(private readonly config: ConfigService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const localDemoMode =
            this.config.get<string>('LOCAL_DEMO_MODE') === 'true' &&
            this.config.get<string>('APP_ENV') === 'local' &&
            this.config.get<string>('NODE_ENV') !== 'production';
        if (
            localDemoMode &&
            request.method === 'POST' &&
            request.path.endsWith('/admin/login')
        ) {
            return true;
        }
        const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token)
            throw new UnauthorizedException(
                'Sign in as an administrator to continue.'
            );

        const supabaseUrl = this.config.get<string>('SUPABASE_URL');
        const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
        const adminEmail = this.config
            .get<string>('ADMIN_EMAIL')
            ?.toLowerCase();
        if (localDemoMode) {
            if (token === `local-demo:${adminEmail}`) return true;
            throw new UnauthorizedException(
                'The local demo session is invalid.'
            );
        }
        if (!supabaseUrl || !anonKey || !adminEmail) {
            throw new UnauthorizedException(
                'CMS authentication is not configured.'
            );
        }

        try {
            const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
                headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) throw new UnauthorizedException();
            const user = (await response.json()) as { email?: string };
            if (user.email?.toLowerCase() !== adminEmail) {
                throw new UnauthorizedException();
            }
            return true;
        } catch {
            throw new UnauthorizedException(
                'The administrator session is invalid.'
            );
        }
    }
}
