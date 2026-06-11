import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Project } from "@webtoon/shared";
import { GENERATED_DIR, PROJECTS_DIR, UPLOADS_DIR } from "./paths";

@Injectable()
export class ProjectStore {
  private async ensureDirs(): Promise<void> {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(GENERATED_DIR, { recursive: true });
  }

  private filePath(id: string): string {
    return path.join(PROJECTS_DIR, `${id}.json`);
  }

  async save(project: Project): Promise<Project> {
    await this.ensureDirs();
    project.updatedAt = new Date().toISOString();
    await fs.writeFile(this.filePath(project.id), JSON.stringify(project, null, 2));
    return project;
  }

  async get(id: string): Promise<Project> {
    try {
      const raw = await fs.readFile(this.filePath(id), "utf-8");
      return JSON.parse(raw) as Project;
    } catch {
      throw new NotFoundException(`project ${id} not found`);
    }
  }

  async list(): Promise<Project[]> {
    await this.ensureDirs();
    const files = await fs.readdir(PROJECTS_DIR);
    const projects: Project[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(PROJECTS_DIR, f), "utf-8");
      projects.push(JSON.parse(raw) as Project);
    }
    return projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
