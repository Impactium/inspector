import { NestFactory } from '@nestjs/core';
import { Api } from './api';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const api = await NestFactory.create(Api.Module);

  api.setGlobalPrefix('/api');

  api.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  api.enableCors({
    origin: (_, cb) => cb(null, true),
    methods: '*',
    allowedHeaders: '*',
    exposedHeaders: '*'
  });

  SwaggerModule.setup('/api/docs', api, SwaggerModule.createDocument(api, new DocumentBuilder()
    .setTitle('API | Inspector')
    .build()
  ));

  await api.listen(1488);
}
bootstrap();
