import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set Winston as the default logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Global exception filter to handle circular reference errors
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS configuration
  const productionOrigins = [
    'http://localhost:3000', // For local development
    // This RegEx matches:
    // 1. https://rodinya-case-frontend.pages.dev (your main site)
    // 2. https://<any-preview-id>.rodinya-case-frontend.pages.dev (all preview sites)
    /^https:\/\/([a-zA-Z0-9-]+\.)?rodinya-case-frontend\.pages\.dev$/
  ];

  // REMOVED: const isDevelopment = process.env.NODE_ENV === 'development';
  app.enableCors({
    // JUST USE THE ARRAY YOU ALREADY MADE!
    // It works for both development (localhost) and production (RegEx).
    origin: productionOrigins,
    
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // Cookie parser middleware
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Ordering Service API')
    .setDescription('API documentation for the Ordering Service Backend')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addCookieAuth('access_token', {
      type: 'http',
      in: 'cookie',
      scheme: 'Bearer',
      description: 'JWT access token stored in HTTP-only cookie',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 8000;
  await app.listen(port);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  logger.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}
bootstrap();
