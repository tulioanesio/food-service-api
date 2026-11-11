import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception/http-exception.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception/prisma-exception.filter';
import { setupSwagger } from './config/swagger/swagger';

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

 :: NestJS Template by tulioanesio::        (v1.3.2)
\x1b[0m
`;

async function bootstrap() {
  console.log(STARTUP_BANNER);

  const app = await NestFactory.create(AppModule, { rawBody: true });

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

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/api/v${defaultVersion}`,
  );
  Logger.log(`📖 Documentation is available at: http://localhost:${port}/docs`);
  Logger.log(
    `📍 Health check is available at: http://localhost:${port}/v${defaultVersion}/health`,
  );
}
void bootstrap().catch((error: unknown) => {
  console.error('[FATAL] Falha ao iniciar aplicação:', error);
  process.exitCode = 1;
});
