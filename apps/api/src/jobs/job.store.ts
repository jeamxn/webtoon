import { Injectable, NotFoundException } from "@nestjs/common";
import type { Job, JobStatus, JobType } from "@webtoon/shared";
import { nanoid } from "nanoid";
import { DbService } from "../infra/db.service";

interface JobRow {
  id: string;
  project_id: string;
  type: JobType;
  params: Record<string, unknown>;
  status: JobStatus;
  progress_text: string;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

function toJob(r: JobRow): Job {
  return {
    id: r.id,
    projectId: r.project_id,
    type: r.type,
    params: r.params,
    status: r.status,
    progressText: r.progress_text,
    error: r.error ?? undefined,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

@Injectable()
export class JobStore {
  constructor(private readonly db: DbService) {}

  async create(projectId: string, type: JobType, params: Record<string, unknown>): Promise<Job> {
    const id = nanoid(12);
    const res = await this.db.pool.query<JobRow>(
      `INSERT INTO jobs (id, project_id, type, params) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, projectId, type, JSON.stringify(params)],
    );
    return toJob(res.rows[0]);
  }

  async setStatus(id: string, status: JobStatus, error?: string): Promise<Job> {
    const res = await this.db.pool.query<JobRow>(
      `UPDATE jobs SET status = $2, error = $3, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, status, error ?? null],
    );
    if (res.rows.length === 0) throw new NotFoundException(`job ${id} not found`);
    return toJob(res.rows[0]);
  }

  async appendProgress(id: string, chunk: string): Promise<void> {
    await this.db.pool.query(
      `UPDATE jobs SET progress_text = progress_text || $2, updated_at = now() WHERE id = $1`,
      [id, chunk],
    );
  }

  async get(id: string): Promise<Job> {
    const res = await this.db.pool.query<JobRow>("SELECT * FROM jobs WHERE id = $1", [id]);
    if (res.rows.length === 0) throw new NotFoundException(`job ${id} not found`);
    return toJob(res.rows[0]);
  }

  async listByProject(projectId: string, activeOnly = false): Promise<Job[]> {
    const res = await this.db.pool.query<JobRow>(
      `SELECT * FROM jobs WHERE project_id = $1
       ${activeOnly ? "AND status IN ('pending','running')" : ""}
       ORDER BY created_at DESC LIMIT 100`,
      [projectId],
    );
    return res.rows.map(toJob);
  }
}
