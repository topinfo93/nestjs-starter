import { type CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { registerAs } from '@nestjs/config';

import { APP_ENVIRONMENT } from 'src/app/enums/app.enum';

export default registerAs('app', () => {
    const localDemoMode =
        process.env.LOCAL_DEMO_MODE === 'true' &&
        process.env.APP_ENV === 'local' &&
        process.env.NODE_ENV !== 'production';
    const configuredOrigins = process.env.APP_CORS_ORIGINS
        ? process.env.APP_CORS_ORIGINS.split(',').map(origin => origin.trim())
        : ['*'];
    const corsOrigins = localDemoMode
        ? [
              ...new Set([
                  ...configuredOrigins,
                  'http://localhost:5173',
                  'http://127.0.0.1:5173',
              ]),
          ]
        : configuredOrigins;

    const corsConfig: CorsOptions = {
        origin: corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        credentials: true,
        exposedHeaders: ['Content-Range', 'X-Content-Range'],
    };

    return {
        env: process.env.APP_ENV ?? APP_ENVIRONMENT.LOCAL,
        name: process.env.APP_NAME ?? 'nestjs-starter',

        versioning: {
            enable: process.env.HTTP_VERSIONING_ENABLE === 'true',
            prefix: 'v',
            version: process.env.HTTP_VERSION ?? '1',
        },

        throttle: {
            ttl: 60,
            limit: 10,
        },

        http: {
            host: process.env.HTTP_HOST ?? 'localhost',
            port: Number.parseInt(
                process.env.HTTP_PORT ?? process.env.PORT ?? '3000'
            ),
        },

        cors: corsConfig,

        sentry: {
            dsn: process.env.SENTRY_DSN,
            environment: process.env.APP_ENV ?? APP_ENVIRONMENT.LOCAL,
        },

        debug: process.env.APP_DEBUG === 'true',
        logLevel: process.env.APP_LOG_LEVEL ?? 'info',
    };
});
