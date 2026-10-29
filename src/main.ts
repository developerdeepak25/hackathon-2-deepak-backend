import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.validation.js';
import { seedDatabase } from './seed/seed-database.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(express.json({ limit: '2mb' }));
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: resolveCorsOrigin(config.get('FRONTEND_URL', { infer: true })),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-job-secret'],
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PolicyHawk API')
    .setDescription(
      'Browse tracked companies and inspect privacy-policy changes detected by PolicyHawk.',
    )
    .setVersion('1.0')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, openApiDocument);

  await seedDatabase(app);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`PolicyHawk API listening on port ${port}`, 'Bootstrap');
}

await bootstrap();

/** `*` allows every browser origin. Any other value is a comma-separated allow-list. */
function resolveCorsOrigin(frontendUrl: string): true | string[] {
  const origins = frontendUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) {
    return true;
  }
  return origins;
}
