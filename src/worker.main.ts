import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './crawler/worker/worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // Application context only; worker service consumes messages in background.
  return app;
}

void bootstrap();
