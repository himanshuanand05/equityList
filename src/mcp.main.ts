import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { McpModule } from './mcp/mcp.module';
import { McpServerService } from './mcp/mcp-server.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(McpModule, {
    logger: ['error', 'warn'],
  });

  // Resolve the service so it can initialize the MCP server over stdio.
  app.get(McpServerService);
}

void bootstrap();

