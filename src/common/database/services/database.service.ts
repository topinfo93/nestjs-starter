import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    private readonly pool: Pool;

    constructor(configService: ConfigService) {
        const connectionUrl = new URL(
            configService.getOrThrow<string>('DATABASE_URL')
        );
        const databasePassword = configService.get<string>('DATABASE_PASSWORD');
        if (databasePassword) {
            // Keep the database password in its own secret so it does not need
            // to be URL-encoded or embedded in a connection string.
            connectionUrl.password = databasePassword;
        }
        const pool = new Pool({
            connectionString: connectionUrl.toString(),
        });
        super({ adapter: new PrismaPg(pool) });
        this.pool = pool;
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }

    async isHealthy(): Promise<HealthIndicatorResult> {
        try {
            await this.$queryRaw`SELECT 1`;
            return { prisma: { status: 'up' } };
        } catch {
            return { prisma: { status: 'down' } };
        }
    }
}
