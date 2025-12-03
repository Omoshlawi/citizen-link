/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { BetterAuthWithPlugins } from './auth/auth.types';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { mergeBetterAuthSchema } from './app.utils';
import { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  const appConfig = app.get(AppConfig);
  const authService: AuthService<BetterAuthWithPlugins> = app.get(AuthService);

  // Set up swagger docs
  const betterAuthOpenAPISchema = await authService.api.generateOpenAPISchema({
    path: '/api/auth',
  });

  const config = new DocumentBuilder()
    .setTitle('Docufind API')
    .setDescription('Docufind API Documentation')
    .setVersion('1.0')
    .build();

  // Create the main Docufind document
  const hiveDocument = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, config),
  );

  // Merge Better Auth paths and components into Docufind document
  const mergedDocument = mergeBetterAuthSchema(
    hiveDocument,
    betterAuthOpenAPISchema,
  );

  // Setup Swagger with merged documentation
  SwaggerModule.setup('api', app, mergedDocument);

  app.use('/api-doc', (req: Request, res: Response, _next: NextFunction) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html>
          <html>
            <head>
              <title>Scalar API Reference</title>
              <meta charset="utf-8" />
              <meta
                name="viewport"
                content="width=device-width, initial-scale=1" />
            </head>
            <body>
              <!-- Need a Custom Header? Check out this example: https://codepen.io/scalarorg/pen/VwOXqam -->
              <!-- Note: We're using our public proxy to avoid CORS issues. You can remove the \`data-proxy-url\` attribute if you don't need it. -->
              <script
                id="api-reference"
                data-url="/api-json"></script>

              <!-- Optional: You can set a full configuration object like this: -->
              <script>
                var configuration = {
                  theme: 'purple',
                }

                document.getElementById('api-reference').dataset.configuration =
                  JSON.stringify(configuration)
              </script>

              <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
            </body>
          </html>`);
    res.end();
  });
  await app.listen(appConfig.port);
  logger.log(`Server is running on port ${appConfig.port}`);
  logger.log(
    `Swagger is running on http://localhost:${appConfig.port}/api-doc`,
  );
}
bootstrap();
