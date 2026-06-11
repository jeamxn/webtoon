import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  readonly pool: Pool;

  constructor(config: ConfigService) {
    // individual params (PG-style env) instead of a URL, so no credentials-in-URL
    this.pool = new Pool({
      host: config.get<string>("PGHOST") ?? "localhost",
      port: Number(config.get<string>("PGPORT") ?? 5432),
      user: config.get<string>("PGUSER") ?? "webtoon",
      password: config.get<string>("PGPASSWORD") ?? "webtoon",
      database: config.get<string>("PGDATABASE") ?? "webtoon",
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        params JSONB NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        progress_text TEXT NOT NULL DEFAULT '',
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS jobs_project_idx ON jobs(project_id);
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        mime TEXT NOT NULL,
        content BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
