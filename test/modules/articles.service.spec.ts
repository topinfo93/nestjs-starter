import { ArticlesService } from '../../src/modules/articles/articles.service';

describe('ArticlesService local demo mode', () => {
    const config = {
        get: (key: string) =>
            ({ LOCAL_DEMO_MODE: 'true', APP_ENV: 'local' })[key],
    };
    const service = new ArticlesService({} as never, config as never);

    it('exposes a published sample article without a database', async () => {
        const articles = await service.listPublished();
        expect(articles.length).toBeGreaterThan(0);
        expect(articles[0]).toMatchObject({
            slug: 'welcome-to-home-ground',
            title: 'Welcome to Home Ground',
            status: 'PUBLISHED',
            isSample: true,
        });
    });

    it('supports in-memory article creation and publishing', async () => {
        const article = await service.create({
            title: 'Bài thử local không ghi database',
            content: 'Nội dung kiểm tra',
        });
        expect(article.slug).toBe('bai-thu-local-khong-ghi-database');
        expect(article.status).toBe('DRAFT');

        const published = await service.update(article.id, {
            status: 'PUBLISHED',
        });
        expect(published.publishedAt).toBeInstanceOf(Date);
        expect((await service.getPublished(article.slug)).id).toBe(article.id);
    });

    it('supports deleting an in-memory article', async () => {
        const article = await service.create({
            title: 'Bài thử xóa local',
            content: 'Nội dung',
        });
        await expect(service.remove(article.id)).resolves.toEqual({
            deleted: true,
        });
    });
});
