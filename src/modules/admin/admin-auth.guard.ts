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
        const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token)
            throw new UnauthorizedException('Đăng nhập quản trị để tiếp tục.');

        const supabaseUrl = this.config.get<string>('SUPABASE_URL');
        const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
        const adminEmail = this.config
            .get<string>('ADMIN_EMAIL')
            ?.toLowerCase();
        if (!supabaseUrl || !anonKey || !adminEmail) {
            throw new UnauthorizedException('CMS chưa được cấu hình xác thực.');
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
                'Phiên đăng nhập quản trị không hợp lệ.'
            );
        }
    }
}
