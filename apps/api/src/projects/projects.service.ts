import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  Answer,
  CreateProjectResponse,
  EpisodeDetail,
  Project,
  Question,
} from "@webtoon/shared";
import { nanoid } from "nanoid";
import type { LlmService } from "../llm/llm.service";
import { UPLOADS_DIR } from "../storage/paths";
import type { ProjectStore } from "../storage/project.store";
import type { UploadedImageFile } from "./upload.types";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly store: ProjectStore,
    private readonly llm: LlmService,
  ) {}

  list(): Promise<Project[]> {
    return this.store.list();
  }

  get(id: string): Promise<Project> {
    return this.store.get(id);
  }

  async create(topic: string, files: UploadedImageFile[]): Promise<CreateProjectResponse> {
    if (!topic?.trim()) throw new BadRequestException("topic is required");
    const id = nanoid(10);
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const exampleImages = await Promise.all(
      (files ?? []).map(async (f, i) => {
        const ext = path.extname(f.originalname) || ".png";
        const filename = `${id}-${i}${ext}`;
        await fs.writeFile(path.join(UPLOADS_DIR, filename), f.buffer);
        return { id: `${id}-${i}`, filename, url: `/files/uploads/${filename}` };
      }),
    );

    const now = new Date().toISOString();
    const project: Project = {
      id,
      topic: topic.trim(),
      exampleImages,
      phase: "interview",
      rounds: [],
      episodes: [],
      createdAt: now,
      updatedAt: now,
    };

    const questions = await this.llm.generateQuestions(project);
    project.rounds.push({ round: 1, questions, answers: [] });
    await this.store.save(project);
    return { project, questions };
  }

  /** submit answers for the latest round; returns next questions (or null if user should finalize) */
  async answer(
    id: string,
    answers: Answer[],
  ): Promise<{ project: Project; questions: Question[] }> {
    const project = await this.store.get(id);
    if (project.phase !== "interview") throw new BadRequestException("interview already finished");
    const round = project.rounds.at(-1);
    if (!round) throw new BadRequestException("no active round");
    round.answers = answers;

    const questions = await this.llm.generateQuestions(project);
    project.rounds.push({ round: project.rounds.length + 1, questions, answers: [] });
    await this.store.save(project);
    return { project, questions };
  }

  async buildStoryboard(id: string): Promise<Project> {
    const project = await this.store.get(id);
    // drop a trailing unanswered round
    const last = project.rounds.at(-1);
    if (last && last.answers.length === 0) project.rounds.pop();

    project.storyboard = await this.llm.generateStoryboard(project);
    project.phase = "storyboard";
    return this.store.save(project);
  }

  async detailEpisode(id: string, episodeIndex: number): Promise<EpisodeDetail> {
    const project = await this.store.get(id);
    const detail = await this.llm.generateEpisodeDetail(project, episodeIndex);
    project.episodes = project.episodes.filter((e) => e.index !== episodeIndex).concat(detail);
    project.episodes.sort((a, b) => a.index - b.index);
    project.phase = "episodes";
    await this.store.save(project);
    return detail;
  }

  async generatePanelImage(
    id: string,
    episodeIndex: number,
    panelIndex: number,
  ): Promise<EpisodeDetail> {
    const project = await this.store.get(id);
    const episode = project.episodes.find((e) => e.index === episodeIndex);
    if (!episode) throw new BadRequestException(`episode ${episodeIndex} not detailed yet`);
    const panel = episode.panels.find((p) => p.index === panelIndex);
    if (!panel) throw new BadRequestException(`panel ${panelIndex} not found`);

    const outName = `${id}-ep${episodeIndex}-p${panelIndex}-${Date.now()}`;
    panel.imageUrl = await this.llm.generatePanelImage(project, panel.imagePrompt, outName);
    await this.store.save(project);
    return episode;
  }
}
