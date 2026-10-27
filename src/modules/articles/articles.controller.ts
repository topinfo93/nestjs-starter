import { Controller, Get, Param, Version } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PublicRoute } from 'src/common/request/decorators/public.decorator';

import { ArticlesService } from './articles.service';

@ApiTags('articles')
@PublicRoute()
@Controller('articles')
export class ArticlesController {
    constructor(private readonly articles: ArticlesService) {}

    @Version('1')
    @Get()
    list() {
        return this.articles.listPublished();
    }

    @Version('1')
    @Get(':slug')
    get(@Param('slug') slug: string) {
        return this.articles.getPublished(slug);
    }
}
