import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UnauthorizedException,
    UseGuards,
    Version,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
        private readonly football: FootballService,
        private readonly config: ConfigService
    ) {}

    @Version('1')
    @Post('login')
    login(@Body() input: { email?: string; password?: string }) {
        const demoMode =
            this.config.get<string>('LOCAL_DEMO_MODE') === 'true' &&
            this.config.get<string>('APP_ENV') === 'local' &&
            this.config.get<string>('NODE_ENV') !== 'production';
        const adminEmail = this.config
            .get<string>('ADMIN_EMAIL')
            ?.toLowerCase();
        const localPassword =
            this.config.get<string>('LOCAL_ADMIN_PASSWORD') ??
            'san-nha-local-demo';
        if (
            !demoMode ||
            input.email?.toLowerCase() !== adminEmail ||
            input.password !== localPassword
        ) {
            throw new UnauthorizedException(
                'The local demo credentials are invalid.'
            );
        }
        return { access_token: `local-demo:${adminEmail}` };
    }

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
