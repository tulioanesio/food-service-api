import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/http-exception/http-exception.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception/prisma-exception.filter';
import { setupSwagger } from './swagger/swagger';

const STARTUP_BANNER = `
\x1b[31m
  _   _           _   _____             _ _       
 | \\ | |         | | |_   _|           (_) |      
 |  \\| | ___  ___| |_  | |  __ _ _ __   _| |_ ___ 
 | . \` |/ _ \\/ __| __| | | / _\` | '_ \\ | | __/ _ \\
 | |\\  |  __/\\__ \\ |_ _| || (_| | | | || | ||  __/
 \\_| \\_/\\___||___/\\__\\___/ \\__, |_| |_||_|\\__\\___|
                            __/ |                 
                           |___/                  

 :: NestJS Template by tulioanesio::        (v1.0.0)
\x1b[0m
`;

async function bootstrap() {
  console.log(STARTUP_BANNER);

  const app = await NestFactory.create(AppModule);
  const defaultVersion = '1';

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://cdn.jsdelivr.net',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
        },
      },
    }),
  );

  const configService = app.get(ConfigService);

  const origins =
    configService.get<string>('ALLOWED_ORIGINS')?.split(',') ?? [];
  app.enableCors({
    origin: origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const { httpAdapter } = app.get(HttpAdapterHost);

  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new PrismaClientExceptionFilter(httpAdapter),
  );

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  setupSwagger(app, configService);

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/api/v${defaultVersion}`,
  );
  Logger.log(`📖 Documentation is available at: http://localhost:${port}/docs`);
  Logger.log(
    `📍 Health check is available at: http://localhost:${port}/v${defaultVersion}/health`,
  );
}
bootstrap();
