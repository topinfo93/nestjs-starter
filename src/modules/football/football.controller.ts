import { Controller, Get, Param, Query, Version } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PublicRoute } from 'src/common/request/decorators/public.decorator';

import { FootballService } from './football.service';

@ApiTags('football')
@PublicRoute()
@Controller('football')
export class FootballController {
    constructor(private readonly football: FootballService) {}

    @Version('1')
    @Get('competitions')
    competitions() {
        return this.football.getCompetitions();
    }

    @Version('1')
    @Get('matches')
    matches(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('competition') competition?: string
    ) {
        return this.football.getMatches({ from, to, competition });
    }

    @Version('1')
    @Get('matches/:id')
    match(@Param('id') id: string) {
        return this.football.getMatch(Number(id));
    }

    @Version('1')
    @Get('competitions/:code')
    competition(@Param('code') code: string) {
        return this.football.getCompetition(code.toUpperCase());
    }

    @Version('1')
    @Get('standings/:code')
    standings(@Param('code') code: string) {
        return this.football.getStandings(code.toUpperCase());
    }
}
