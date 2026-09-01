// Sentry must load before everything else it instruments.
import './monitoring/instrument';
import { Logger, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { badRequest } from './common/exceptions';
import { AppConfigService } from './config/app-config.service';
import { BUILD_INFO } from './config/version';

function flattenValidationErrors(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? Object.values(error.constraints) : [];
    const nested = error.children?.length
      ? flattenValidationErrors(error.children, path)
      : [];
    return [...own, ...nested];
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  const expressApp = app.getHttpAdapter().getInstance() as express.Express;
  expressApp.disable('x-powered-by');
  // Convenience: the API root points at the interactive docs.
  expressApp.get('/', (_req, res) => res.redirect('/docs'));

  app.use((req: Request & { id?: string }, res: Response, next: NextFunction) => {
    req.id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  });

  app.use(
    helmet({
      // Swagger UI ships inline scripts; CSP adds little for a JSON API.
      contentSecurityPolicy: false,
      // Uploaded logos are embedded by the web app on a different origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 3600,
  });

  app.use('/uploads', express.static(config.uploadDir, { index: false, maxAge: '7d' }));

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = flattenValidationErrors(errors);
        return badRequest('VALIDATION_ERROR', messages[0] ?? 'Invalid request.', {
          details: messages,
        });
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Loyalty Platform API')
    .setDescription(
      'Multi-tenant loyalty platform — Phase 1. Authenticate via the OTP endpoints, ' +
        'then click Authorize and paste the accessToken.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Loyalty Platform API docs',
  });

  app.enableShutdownHooks();

  await app.listen(config.port);
  logger.log(`API listening on http://localhost:${config.port} (docs at /docs)`);
  logger.log(
    `Stamposa API v${BUILD_INFO.version} · commit ${BUILD_INFO.commit} · built ${BUILD_INFO.builtAt}`,
  );
}

void bootstrap();
