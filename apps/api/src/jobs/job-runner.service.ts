import { Injectable, Logger } from "@nestjs/common";
import type { Character, Job, JobType, Panel } from "@webtoon/shared";
import { nanoid } from "nanoid";
import { LlmService } from "../llm/llm.service";
import { ImageStore } from "../storage/image.store";
import { ProjectStore } from "../storage/project.store";
import { EventsService } from "./events.service";
import { JobStore } from "./job.store";

const PROGRESS_FLUSH_MS = 400;

@Injectable()
export class JobRunnerService {
  private readonly logger = new Logger(JobRunnerService.name);

  constructor(
    private readonly jobs: JobStore,
    private readonly projects: ProjectStore,
    private readonly images: ImageStore,
    private readonly llm: LlmService,
    private readonly events: EventsService,
  ) {}

  /** create a job and run it in the background (fire-and-forget). multiple jobs run in parallel. */
  async enqueue(projectId: string, type: JobType, params: Record<string, unknown>): Promise<Job> {
    const job = await this.jobs.create(projectId, type, params);
    void this.run(job).catch((e) => this.logger.error(`job ${job.id} crashed: ${e}`));
    return job;
  }

  private async run(job: Job): Promise<void> {
    let running = await this.jobs.setStatus(job.id, "running");
    await this.events.publishJob(running);

    // throttled progress streamer: buffers LLM deltas, flushes to DB + SSE
    let buffer = "";
    let progressText = "";
    let timer: NodeJS.Timeout | null = null;
    const flush = async () => {
      if (!buffer) return;
      const chunk = buffer;
      buffer = "";
      progressText += chunk;
      await this.jobs.appendProgress(job.id, chunk);
      running = { ...running, progressText, updatedAt: new Date().toISOString() };
      await this.events.publishJob(running);
    };
    const onProgress = (delta: string) => {
      buffer += delta;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          void flush();
        }, PROGRESS_FLUSH_MS);
      }
    };

    try {
      await this.execute(job, onProgress);
      if (timer) clearTimeout(timer);
      await flush();
      const done = await this.jobs.setStatus(job.id, "done");
      await this.events.publishJob(done);
      await this.events.publishProject(job.projectId);
    } catch (e) {
      if (timer) clearTimeout(timer);
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`job ${job.id} (${job.type}) failed: ${message}`);
      const failed = await this.jobs.setStatus(job.id, "error", message);
      await this.events.publishJob(failed);
    }
  }

  private async execute(job: Job, onProgress: (s: string) => void): Promise<void> {
    const project = await this.projects.get(job.projectId);

    switch (job.type) {
      case "questions": {
        const questions = await this.llm.generateQuestions(project, onProgress);
        await this.projects.update(job.projectId, (p) => {
          p.rounds.push({ round: p.rounds.length + 1, questions, answers: [] });
        });
        break;
      }

      case "storyboard": {
        const storyboard = await this.llm.generateStoryboard(project, onProgress);
        await this.projects.update(job.projectId, (p) => {
          p.storyboard = storyboard;
          p.phase = "storyboard";
        });
        // chain: generate character sheets right after the storyboard
        await this.enqueue(job.projectId, "characters", {});
        break;
      }

      case "characters": {
        const defs = await this.llm.generateCharacters(project, onProgress);
        const characters: Character[] = defs.map((d) => ({ ...d, id: nanoid(8) }));
        await this.projects.update(job.projectId, (p) => {
          p.characters = characters;
        });
        // fan out: one parallel image job per character
        for (const c of characters) {
          await this.enqueue(job.projectId, "character_image", { characterId: c.id });
        }
        break;
      }

      case "character_image": {
        const characterId = String(job.params.characterId);
        const character = project.characters.find((c) => c.id === characterId);
        if (!character) throw new Error(`character ${characterId} not found`);
        onProgress(`캐릭터 시트 이미지 생성 중: ${character.name}\n`);
        const refs = await this.exampleRefs(project);
        const png = await this.llm.generateImage(
          `Character reference sheet. ${character.imagePrompt}` +
            " Match the art style of the reference images exactly.",
          refs,
        );
        const imageId = await this.images.save(project.id, png);
        await this.projects.update(job.projectId, (p) => {
          const c = p.characters.find((x) => x.id === characterId);
          if (c) c.imageUrl = `/api/images/${imageId}`;
        });
        break;
      }

      case "episode_detail": {
        const episodeIndex = Number(job.params.episodeIndex);
        const detail = await this.llm.generateEpisodeDetail(project, episodeIndex, onProgress);
        await this.projects.update(job.projectId, (p) => {
          p.episodes = p.episodes.filter((e) => e.index !== episodeIndex).concat(detail);
          p.episodes.sort((a, b) => a.index - b.index);
          p.phase = "episodes";
        });
        break;
      }

      case "panel_image": {
        const episodeIndex = Number(job.params.episodeIndex);
        const panelIndex = Number(job.params.panelIndex);
        const episode = project.episodes.find((e) => e.index === episodeIndex);
        if (!episode) throw new Error(`episode ${episodeIndex} not detailed yet`);
        const panel = episode.panels.find((p) => p.index === panelIndex);
        if (!panel) throw new Error(`panel ${panelIndex} not found`);

        onProgress(`컷 이미지 생성 중: ${episodeIndex}화 ${panelIndex}컷\n`);
        const refs = await this.panelRefs(project, panel);
        const prompt =
          `A single webtoon cut: exactly ONE scene at ONE moment in time. ${panel.imagePrompt}` +
          (project.storyboard ? ` Art style: ${project.storyboard.artStyle}.` : "") +
          " Korean vertical-scroll webtoon aesthetic." +
          " IMPORTANT: one full-bleed illustration only — do NOT divide the image into multiple panels," +
          " frames, or a comic-page grid. No panel borders, no sequences, no before/after shots." +
          " Reference images are character design sheets and style samples: copy the character designs" +
          " and art style ONLY, never their collage/sheet layout.";
        const png = await this.llm.generateImage(prompt, refs);
        const imageId = await this.images.save(project.id, png);
        await this.projects.update(job.projectId, (p) => {
          const ep = p.episodes.find((e) => e.index === episodeIndex);
          const pn = ep?.panels.find((x) => x.index === panelIndex);
          if (pn) pn.imageUrl = `/api/images/${imageId}`;
        });
        break;
      }

      case "revise_episodes": {
        const instruction = String(job.params.instruction ?? "");
        const out = await this.llm.reviseEpisodes(project, instruction, onProgress);
        await this.projects.update(job.projectId, (p) => {
          if (!p.storyboard) throw new Error("storyboard not generated yet");
          p.storyboard.episodes = out.episodes.sort((a, b) => a.index - b.index);
        });
        break;
      }

      default:
        throw new Error(`unknown job type: ${job.type}`);
    }
  }

  /** style references: uploaded example images */
  private async exampleRefs(project: {
    id: string;
    exampleImages: { url: string; filename: string }[];
  }): Promise<{ buffer: Buffer; name: string }[]> {
    const out: { buffer: Buffer; name: string }[] = [];
    for (const img of project.exampleImages.slice(0, 4)) {
      const id = img.url.split("/").pop();
      if (!id) continue;
      const stored = await this.images.get(id);
      out.push({ buffer: stored.content, name: img.filename });
    }
    return out;
  }

  /** panel references: character sheets of appearing characters + example style images */
  private async panelRefs(
    project: {
      id: string;
      exampleImages: { url: string; filename: string }[];
      characters: Character[];
    },
    panel: Panel,
  ): Promise<{ buffer: Buffer; name: string }[]> {
    const refs = await this.exampleRefs(project);
    for (const name of panel.characterNames ?? []) {
      const c = project.characters.find((x) => x.name === name);
      if (!c?.imageUrl) continue;
      const id = c.imageUrl.split("/").pop();
      if (!id) continue;
      const stored = await this.images.get(id);
      refs.push({ buffer: stored.content, name: `char-${c.name}.png` });
    }
    return refs.slice(0, 6);
  }
}
