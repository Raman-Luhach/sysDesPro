import 'dotenv/config';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { appConfig } from './common/config/app-config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true, exposedHeaders: ['X-Served-By'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  // Shows which instance answered: proves the load balancer spreads traffic.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Served-By', appConfig.instanceId);
    next();
  });

  const io = new RedisIoAdapter(app);
  io.connect();
  app.useWebSocketAdapter(io);

  await app.listen(appConfig.port, '0.0.0.0');
  Logger.log(`FlashSlot API (${appConfig.instanceId}) listening on :${appConfig.port}`, 'Bootstrap');
}

process.on('unhandledRejection', (reason) => Logger.warn(`Unhandled rejection: ${reason}`, 'Process'));

void bootstrap();
