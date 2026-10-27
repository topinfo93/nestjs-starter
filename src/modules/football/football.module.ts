import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';

import { FootballController } from './football.controller';
import { FootballService } from './football.service';

@Module({
    imports: [DatabaseModule],
    controllers: [FootballController],
    providers: [FootballService],
    exports: [FootballService],
})
export class FootballModule {}
