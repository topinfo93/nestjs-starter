import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

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

@Injectable()
export class ArticlesService {
    constructor(private readonly db: DatabaseService) {}

    listPublished() {
        return this.db.article.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { publishedAt: 'desc' },
            take: 30,
        });
    }

    async getPublished(slug: string) {
        const article = await this.db.article.findFirst({
            where: { slug, status: 'PUBLISHED' },
        });
        if (!article) throw new NotFoundException('Không tìm thấy bài viết.');
        return article;
    }

    listAll() {
        return this.db.article.findMany({ orderBy: { updatedAt: 'desc' } });
    }

    create(input: ArticleInput) {
        const slug = toSlug(input.slug ?? input.title);
        if (!slug)
            throw new BadRequestException('Đường dẫn bài viết không hợp lệ.');
        return this.db.article.create({
            data: {
                ...input,
                slug,
                publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
            },
        });
    }

    async update(id: string, input: ArticleUpdateInput) {
        const current = await this.db.article.findUnique({ where: { id } });
        if (!current) throw new NotFoundException('Không tìm thấy bài viết.');
        const status = input.status ?? current.status;
        const slugValue = input.slug ?? input.title ?? current.title;
        const slug = toSlug(slugValue);
        if ((input.slug !== undefined || input.title !== undefined) && !slug) {
            throw new BadRequestException('Đường dẫn bài viết không hợp lệ.');
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
        await this.db.article.delete({ where: { id } });
        return { deleted: true };
    }
}
