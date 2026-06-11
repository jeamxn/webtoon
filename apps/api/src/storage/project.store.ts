import { Injectable, NotFoundException } from "@nestjs/common";
import type { Project } from "@webtoon/shared";
import { DbService } from "../infra/db.service";
import { RedisService } from "../infra/redis.service";

const CACHE_TTL_SEC = 300;
const key = (id: string) => `project:${id}`;

@Injectable()
export class ProjectStore {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
  ) {}

  async save(project: Project): Promise<Project> {
    project.updatedAt = new Date().toISOString();
    await this.db.pool.query(
      `INSERT INTO projects (id, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = $4`,
      [project.id, JSON.stringify(project), project.createdAt, project.updatedAt],
    );
    await this.redis.client.setex(key(project.id), CACHE_TTL_SEC, JSON.stringify(project));
    return project;
  }

  async get(id: string): Promise<Project> {
    const cached = await this.redis.client.get(key(id));
    if (cached) return JSON.parse(cached) as Project;

    const res = await this.db.pool.query<{ data: Project }>(
      "SELECT data FROM projects WHERE id = $1",
      [id],
    );
    if (res.rows.length === 0) throw new NotFoundException(`project ${id} not found`);
    const project = res.rows[0].data;
    await this.redis.client.setex(key(id), CACHE_TTL_SEC, JSON.stringify(project));
    return project;
  }

  async list(): Promise<Project[]> {
    const res = await this.db.pool.query<{ data: Project }>(
      "SELECT data FROM projects ORDER BY created_at DESC",
    );
    return res.rows.map((r) => r.data);
  }

  /** atomic read-modify-write under a per-project redis lock to avoid lost updates from parallel jobs */
  async update(id: string, mutate: (p: Project) => void | Promise<void>): Promise<Project> {
    const lockKey = `lock:${key(id)}`;
    const deadline = Date.now() + 15_000;
    while (!(await this.redis.client.set(lockKey, "1", "PX", 10_000, "NX"))) {
      if (Date.now() > deadline) throw new Error(`lock timeout for project ${id}`);
      await new Promise((r) => setTimeout(r, 50));
    }
    try {
      await this.redis.client.del(key(id)); // force fresh read
      const project = await this.get(id);
      await mutate(project);
      return await this.save(project);
    } finally {
      await this.redis.client.del(lockKey);
    }
  }
}
