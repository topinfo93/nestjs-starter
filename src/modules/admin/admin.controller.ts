import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
    Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PublicRoute } from 'src/common/request/decorators/public.decorator';
import {
    ArticleInput,
    ArticleUpdateInput,
} from 'src/modules/articles/articles.dto';
import { ArticlesService } from 'src/modules/articles/articles.service';
import { FootballService } from 'src/modules/football/football.service';

import { AdminAuthGuard } from './admin-auth.guard';

@ApiTags('admin')
@ApiBearerAuth()
@PublicRoute()
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminController {
    constructor(
        private readonly articles: ArticlesService,
        private readonly football: FootballService
    ) {}

    @Version('1')
    @Get('session')
    session() {
        return { email: process.env.ADMIN_EMAIL };
    }

    @Version('1')
    @Get('articles')
    listArticles() {
        return this.articles.listAll();
    }

    @Version('1')
    @Post('articles')
    createArticle(@Body() input: ArticleInput) {
        return this.articles.create(input);
    }

    @Version('1')
    @Patch('articles/:id')
    updateArticle(@Param('id') id: string, @Body() input: ArticleUpdateInput) {
        return this.articles.update(id, input);
    }

    @Version('1')
    @Delete('articles/:id')
    deleteArticle(@Param('id') id: string) {
        return this.articles.remove(id);
    }

    @Version('1')
    @Post('sync/:code')
    syncCompetition(@Param('code') code: string) {
        return this.football.syncCompetition(code.toUpperCase(), true);
    }
}
