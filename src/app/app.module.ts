import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { CommonModule } from 'src/common/common.module';
import { AdminModule } from 'src/modules/admin/admin.module';
import { ArticlesModule } from 'src/modules/articles/articles.module';
import { FootballModule } from 'src/modules/football/football.module';

import { HealthController } from './controllers/health.controller';

@Module({
    imports: [
        // Shared Common Services (includes ConfigModule)
        CommonModule,

        // Health Check
        TerminusModule,

        FootballModule,
        ArticlesModule,
        AdminModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
