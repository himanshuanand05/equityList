import { NestFactory } from '@nestjs/core';
import { SchedulerModule } from './crawler/scheduler/scheduler.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SchedulerModule);
  // Application context only; scheduler service runs in background.
  return app;
}

void bootstrap();
