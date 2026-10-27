import { Module } from '@nestjs/common';

import { ArticlesModule } from 'src/modules/articles/articles.module';
import { FootballModule } from 'src/modules/football/football.module';

import { AdminAuthGuard } from './admin-auth.guard';
import { AdminController } from './admin.controller';

@Module({
    imports: [ArticlesModule, FootballModule],
    controllers: [AdminController],
    providers: [AdminAuthGuard],
})
export class AdminModule {}
