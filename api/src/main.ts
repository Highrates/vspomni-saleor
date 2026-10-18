import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

function backendRootDir(): string {
  const cwd = process.cwd().replace(/\/+$/, '');
  if (cwd.endsWith('/api') || cwd.endsWith('/backend')) return cwd;
  return join(cwd, 'api');
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);

  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  // За reverse-proxy (nginx): req.ip / Throttler видят реальный клиент из X-Forwarded-For.
  const trustProxy = config.get<string>('TRUST_PROXY')?.trim();
  if (trustProxy === '0' || trustProxy === 'false' || trustProxy === 'off') {
    app.set('trust proxy', false);
  } else if (trustProxy && /^\d+$/.test(trustProxy)) {
    app.set('trust proxy', Number(trustProxy));
  } else {
    app.set('trust proxy', 1);
  }

  const localDir =
    config.get<string>('LOCAL_UPLOADS_DIR')?.trim() ||
    join(backendRootDir(), '.data', 'local-uploads');
  mkdirSync(localDir, { recursive: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    let path = req.path ?? '';
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep raw */
    }
    const normalized = path.replace(/\\/g, '/').toLowerCase();
    if (normalized.startsWith('/uploads/chat/') || normalized === '/uploads/chat') {
      res.status(404).end();
      return;
    }
    next();
  });
  /** Файлы с диска: http://host:3011/uploads/... */
  app.useStaticAssets(localDir, { prefix: '/uploads/' });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Не fail-open: в production без CORS_ORIGIN — отказ старта.
  const corsRaw = process.env.CORS_ORIGIN?.trim() ?? '';
  const corsOrigins = corsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CORS_ORIGIN is required in production (comma-separated allowlist)');
    }
    app.enableCors({ origin: true, credentials: true });
  } else {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }
  const port = Number(process.env.PORT ?? 3011);
  const host = process.env.HOST?.trim() || '0.0.0.0';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`vspomni-api listening on http://${host}:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`local uploads: ${localDir} → /uploads/`);
}

bootstrap();
