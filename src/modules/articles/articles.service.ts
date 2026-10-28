import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from 'src/common/database/services/database.service';

import { type ArticleInput, type ArticleUpdateInput } from './articles.dto';

const toSlug = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

type DemoArticle = ArticleInput & {
    id: string;
    slug: string;
    isSample: boolean;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
};

const demoArticles: DemoArticle[] = [
    {
        id: 'demo-article-1',
        title: 'Welcome to Home Ground',
        slug: 'welcome-to-home-ground',
        excerpt: 'A sample article for testing the local news page and CMS.',
        content:
            'This is sample content for local demo mode. Changes are kept in memory and reset when the API restarts.',
        status: 'PUBLISHED',
        isSample: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
    },
];

@Injectable()
export class ArticlesService {
    constructor(
        private readonly db: DatabaseService,
        private readonly config: ConfigService
    ) {}

    private get localDemoMode() {
        return (
            this.config.get<string>('LOCAL_DEMO_MODE') === 'true' &&
            this.config.get<string>('APP_ENV') === 'local' &&
            this.config.get<string>('NODE_ENV') !== 'production'
        );
    }

    listPublished() {
        if (this.localDemoMode) {
            return Promise.resolve(
                demoArticles.filter(article => article.status === 'PUBLISHED')
            );
        }
        return this.db.article.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { publishedAt: 'desc' },
            take: 30,
        });
    }

    async getPublished(slug: string) {
        if (this.localDemoMode) {
            const article = demoArticles.find(
                item => item.slug === slug && item.status === 'PUBLISHED'
            );
            if (!article) throw new NotFoundException('Article not found.');
            return article;
        }
        const article = await this.db.article.findFirst({
            where: { slug, status: 'PUBLISHED' },
        });
        if (!article) throw new NotFoundException('Article not found.');
        return article;
    }

    listAll() {
        if (this.localDemoMode) {
            return Promise.resolve(
                [...demoArticles].sort(
                    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
                )
            );
        }
        return this.db.article.findMany({ orderBy: { updatedAt: 'desc' } });
    }

    create(input: ArticleInput) {
        const slug = toSlug(input.slug ?? input.title);
        if (!slug)
            throw new BadRequestException('The article slug is invalid.');
        if (this.localDemoMode) {
            const now = new Date();
            const article: DemoArticle = {
                ...input,
                id: `demo-article-${Date.now()}`,
                slug,
                status: input.status ?? 'DRAFT',
                isSample: input.isSample ?? false,
                createdAt: now,
                updatedAt: now,
                publishedAt: input.status === 'PUBLISHED' ? now : null,
            };
            demoArticles.unshift(article);
            return Promise.resolve(article);
        }
        return this.db.article.create({
            data: {
                ...input,
                slug,
                publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
            },
        });
    }

    async update(id: string, input: ArticleUpdateInput) {
        if (this.localDemoMode) {
            const current = demoArticles.find(article => article.id === id);
            if (!current) throw new NotFoundException('Article not found.');
            const status = input.status ?? current.status;
            const slugValue = input.slug ?? input.title ?? current.title;
            const slug = toSlug(slugValue);
            if (
                (input.slug !== undefined || input.title !== undefined) &&
                !slug
            )
                throw new BadRequestException('The article slug is invalid.');
            Object.assign(current, input, {
                ...(input.slug !== undefined || input.title !== undefined
                    ? { slug }
                    : {}),
                updatedAt: new Date(),
                publishedAt:
                    status === 'PUBLISHED'
                        ? (current.publishedAt ?? new Date())
                        : null,
            });
            return current;
        }
        const current = await this.db.article.findUnique({ where: { id } });
        if (!current) throw new NotFoundException('Article not found.');
        const status = input.status ?? current.status;
        const slugValue = input.slug ?? input.title ?? current.title;
        const slug = toSlug(slugValue);
        if ((input.slug !== undefined || input.title !== undefined) && !slug) {
            throw new BadRequestException('The article slug is invalid.');
        }
        return this.db.article.update({
            where: { id },
            data: {
                ...input,
                ...(input.slug !== undefined || input.title !== undefined
                    ? { slug }
                    : {}),
                publishedAt:
                    status === 'PUBLISHED'
                        ? (current.publishedAt ?? new Date())
                        : null,
            },
        });
    }

    async remove(id: string) {
        if (this.localDemoMode) {
            const index = demoArticles.findIndex(article => article.id === id);
            if (index < 0) throw new NotFoundException('Article not found.');
            demoArticles.splice(index, 1);
            return { deleted: true };
        }
        await this.db.article.delete({ where: { id } });
        return { deleted: true };
    }
}
