/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect, Channel, Connection, ConsumeMessage, Options } from 'amqplib';

@Injectable()
export class AmqpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmqpService.name);
  private connection?: Connection;
  private channel?: Channel;

  async onModuleInit(): Promise<void> {
    const url = process.env.AMQP_URL ?? 'amqp://localhost';
    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    this.logger.log(`Connected to AMQP at ${url}`);
  }

  async assertQueue(
    queue: string,
    options?: Options.AssertQueue,
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      throw new Error('AMQP channel is not initialized');
    }
    await channel.assertQueue(queue, {
      durable: true,
      ...(options ?? {}),
    });
  }

  async sendToQueue(
    queue: string,
    content: Buffer,
    options?: Options.Publish,
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      throw new Error('AMQP channel is not initialized');
    }
    await this.assertQueue(queue);
    channel.sendToQueue(queue, content, {
      persistent: true,
      ...(options ?? {}),
    });
  }

  async consume(
    queue: string,
    onMessage: (msg: ConsumeMessage) => Promise<void>,
    options?: Options.Consume,
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      throw new Error('AMQP channel is not initialized');
    }
    await this.assertQueue(queue);
    await channel.consume(
      queue,
      async (msg) => {
        if (!msg) {
          return;
        }
        try {
          await onMessage(msg);
          channel.ack(msg);
        } catch (error) {
          this.logger.error('Error handling message', error as Error);
          channel.nack(msg, false, false);
        }
      },
      { noAck: false, ...(options ?? {}) },
    );
  }

  async setPrefetch(count: number): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      throw new Error('AMQP channel is not initialized');
    }
    await channel.prefetch(count);
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
