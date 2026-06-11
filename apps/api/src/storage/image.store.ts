import { Injectable, NotFoundException } from "@nestjs/common";
import { nanoid } from "nanoid";
import { DbService } from "../infra/db.service";

@Injectable()
export class ImageStore {
  constructor(private readonly db: DbService) {}

  async save(projectId: string, content: Buffer, mime = "image/png"): Promise<string> {
    const id = nanoid(16);
    await this.db.pool.query(
      "INSERT INTO images (id, project_id, mime, content) VALUES ($1, $2, $3, $4)",
      [id, projectId, mime, content],
    );
    return id;
  }

  async get(id: string): Promise<{ mime: string; content: Buffer }> {
    const res = await this.db.pool.query<{ mime: string; content: Buffer }>(
      "SELECT mime, content FROM images WHERE id = $1",
      [id],
    );
    if (res.rows.length === 0) throw new NotFoundException(`image ${id} not found`);
    return res.rows[0];
  }
}
