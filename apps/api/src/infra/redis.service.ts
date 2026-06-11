import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  /** general-purpose client (cache) */
  readonly client: Redis;
  /** dedicated publisher */
  readonly pub: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.client = new Redis(url);
    this.pub = new Redis(url);
  }

  /** create a dedicated subscriber connection (caller must quit() it) */
  createSubscriber(): Redis {
    return this.client.duplicate();
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.client.quit(), this.pub.quit()]);
  }
}
