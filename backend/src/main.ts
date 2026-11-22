import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { AppModule } from './app.module';
import { Logger } from './common/logger/logger.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: new Logger(),
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3000);
    const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Serve static audio and evidence uploads
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    app.use(`/${apiPrefix}/uploads`, express.static(path.join(process.cwd(), 'uploads')));

    // Security - disable strict CSP on docs so Swagger UI assets can render
    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
        }),
    );
    app.use(compression());

    // CORS
    app.enableCors({
        origin: configService.get<string>('CORS_ORIGIN')?.split(',') || '*',
        credentials: configService.get<boolean>('CORS_CREDENTIALS', true),
    });

    // Global prefix
    app.setGlobalPrefix(apiPrefix);

    // Validates DTOs globally
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Swagger API Documentation
    const config = new DocumentBuilder()
        .setTitle('Women Safety System API')
        .setDescription('Comprehensive API for Women Safety Platform')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'Authentication endpoints')
        .addTag('users', 'User management')
        .addTag('sos', 'SOS and incident management')
        .addTag('volunteers', 'Volunteer management')
        .addTag('zones', 'Safe and danger zones')
        .addTag('media', 'Media upload and retrieval')
        .addTag('admin', 'Admin operations')
        .addTag('analytics', 'Analytics and reporting')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
        customSiteTitle: 'Women Safety API Docs',
        customfavIcon: 'https://nestjs.com/img/logo-small.svg',
        customCss: '.swagger-ui .topbar { display: none }',
    });

    await app.listen(port, '0.0.0.0');

    console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   🚨 Women Safety System Backend Server 🚨          ║
  ║                                                       ║
  ║   Server running on: http://localhost:${port}         ║
  ║   API Docs: http://localhost:${port}/${apiPrefix}/docs    ║
  ║   Environment: ${configService.get('NODE_ENV')}                   ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap();
