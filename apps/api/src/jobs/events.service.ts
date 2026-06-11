import { Injectable, OnModuleDestroy } from "@nestjs/common";
import type { Job, ProjectEvent } from "@webtoon/shared";
import type Redis from "ioredis";
import { Observable } from "rxjs";
import { RedisService } from "../infra/redis.service";

const channel = (projectId: string) => `events:${projectId}`;

@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly subscribers: Redis[] = [];

  constructor(private readonly redis: RedisService) {}

  async publishJob(job: Job): Promise<void> {
    const event: ProjectEvent = {
      kind: "job_update",
      job,
      projectId: job.projectId,
      at: new Date().toISOString(),
    };
    await this.redis.pub.publish(channel(job.projectId), JSON.stringify(event));
  }

  async publishProject(projectId: string): Promise<void> {
    const event: ProjectEvent = { kind: "project_update", projectId, at: new Date().toISOString() };
    await this.redis.pub.publish(channel(projectId), JSON.stringify(event));
  }

  /** rxjs stream of events for one project (used by SSE controller) */
  stream(projectId: string): Observable<MessageEvent> {
    return new Observable((observer) => {
      const sub = this.redis.createSubscriber();
      this.subscribers.push(sub);
      sub.subscribe(channel(projectId));
      sub.on("message", (_ch: string, message: string) => {
        observer.next({ data: message } as MessageEvent);
      });
      return () => {
        sub.unsubscribe(channel(projectId)).catch(() => {});
        sub.quit().catch(() => {});
        const i = this.subscribers.indexOf(sub);
        if (i >= 0) this.subscribers.splice(i, 1);
      };
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.subscribers.map((s) => s.quit()));
  }
}
