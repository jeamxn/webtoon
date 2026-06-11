import { BadRequestException, Injectable } from "@nestjs/common";
import type { Answer, Job, Project } from "@webtoon/shared";
import { nanoid } from "nanoid";
import { EventsService } from "../jobs/events.service";
import { JobStore } from "../jobs/job.store";
import { JobRunnerService } from "../jobs/job-runner.service";
import { ImageStore } from "../storage/image.store";
import { ProjectStore } from "../storage/project.store";
import type { UploadedImageFile } from "./upload.types";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly store: ProjectStore,
    private readonly images: ImageStore,
    private readonly jobs: JobStore,
    private readonly runner: JobRunnerService,
    private readonly events: EventsService,
  ) {}

  list(): Promise<Project[]> {
    return this.store.list();
  }

  get(id: string): Promise<Project> {
    return this.store.get(id);
  }

  listJobs(id: string, activeOnly: boolean): Promise<Job[]> {
    return this.jobs.listByProject(id, activeOnly);
  }

  async create(topic: string, files: UploadedImageFile[]): Promise<{ project: Project; job: Job }> {
    if (!topic?.trim()) throw new BadRequestException("topic is required");
    const id = nanoid(10);
    const now = new Date().toISOString();

    const project: Project = {
      id,
      topic: topic.trim(),
      exampleImages: [],
      phase: "interview",
      rounds: [],
      characters: [],
      episodes: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.store.save(project);

    for (const f of files ?? []) {
      const imageId = await this.images.save(id, f.buffer, f.mimetype || "image/png");
      project.exampleImages.push({
        id: imageId,
        filename: f.originalname,
        url: `/api/images/${imageId}`,
      });
    }
    await this.store.save(project);

    const job = await this.runner.enqueue(id, "questions", {});
    return { project, job };
  }

  /** submit answers for the latest round; enqueues next-questions job */
  async answer(id: string, answers: Answer[]): Promise<{ project: Project; job: Job }> {
    const project = await this.store.update(id, (p) => {
      if (p.phase !== "interview") throw new BadRequestException("interview already finished");
      const round = p.rounds.at(-1);
      if (!round) throw new BadRequestException("no active round");
      round.answers = answers;
    });
    await this.events.publishProject(id);
    const job = await this.runner.enqueue(id, "questions", {});
    return { project, job };
  }

  async buildStoryboard(id: string): Promise<Job> {
    await this.store.update(id, (p) => {
      const last = p.rounds.at(-1);
      if (last && last.answers.length === 0) p.rounds.pop();
    });
    await this.events.publishProject(id);
    return this.runner.enqueue(id, "storyboard", {});
  }

  detailEpisode(id: string, episodeIndex: number): Promise<Job> {
    return this.runner.enqueue(id, "episode_detail", { episodeIndex });
  }

  generatePanelImage(id: string, episodeIndex: number, panelIndex: number): Promise<Job> {
    return this.runner.enqueue(id, "panel_image", { episodeIndex, panelIndex });
  }

  regenerateCharacters(id: string): Promise<Job> {
    return this.runner.enqueue(id, "characters", {});
  }

  generateCharacterImage(id: string, characterId: string): Promise<Job> {
    return this.runner.enqueue(id, "character_image", { characterId });
  }

  /** edit one storyboard episode's title/synopsis directly */
  async editEpisode(
    id: string,
    episodeIndex: number,
    patch: { title?: string; synopsis?: string },
  ): Promise<Project> {
    const project = await this.store.update(id, (p) => {
      const ep = p.storyboard?.episodes.find((e) => e.index === episodeIndex);
      if (!ep) throw new BadRequestException(`episode ${episodeIndex} not found`);
      if (patch.title !== undefined) ep.title = patch.title;
      if (patch.synopsis !== undefined) ep.synopsis = patch.synopsis;
    });
    await this.events.publishProject(id);
    return project;
  }

  /** append a new episode at the end of the storyboard */
  async addEpisode(id: string, title: string, synopsis: string): Promise<Project> {
    const project = await this.store.update(id, (p) => {
      if (!p.storyboard) throw new BadRequestException("storyboard not generated yet");
      const nextIndex = Math.max(0, ...p.storyboard.episodes.map((e) => e.index)) + 1;
      p.storyboard.episodes.push({
        index: nextIndex,
        title: title || `${nextIndex}화`,
        synopsis: synopsis || "",
      });
    });
    await this.events.publishProject(id);
    return project;
  }

  /** LLM-assisted revision/extension of the episode list */
  reviseEpisodes(id: string, instruction: string): Promise<Job> {
    if (!instruction?.trim()) throw new BadRequestException("instruction is required");
    return this.runner.enqueue(id, "revise_episodes", { instruction });
  }
}
