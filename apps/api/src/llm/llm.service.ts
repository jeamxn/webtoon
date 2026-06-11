import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Injectable } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EpisodeDetail, Project, Question, Storyboard } from "@webtoon/shared";
import OpenAI, { toFile } from "openai";
import { GENERATED_DIR, UPLOADS_DIR } from "../storage/paths";

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "options", "allowFreeText"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          allowFreeText: { type: "boolean" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label"],
              properties: { id: { type: "string" }, label: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;

const STORYBOARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "logline", "genre", "artStyle", "characters", "episodes"],
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    genre: { type: "string" },
    artStyle: { type: "string" },
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description"],
        properties: { name: { type: "string" }, description: { type: "string" } },
      },
    },
    episodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "title", "synopsis"],
        properties: {
          index: { type: "integer" },
          title: { type: "string" },
          synopsis: { type: "string" },
        },
      },
    },
  },
} as const;

const EPISODE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["index", "title", "scenario", "panels"],
  properties: {
    index: { type: "integer" },
    title: { type: "string" },
    scenario: { type: "string" },
    panels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "description", "dialogue", "imagePrompt"],
        properties: {
          index: { type: "integer" },
          description: { type: "string" },
          dialogue: { type: "string" },
          imagePrompt: { type: "string" },
        },
      },
    },
  },
} as const;

@Injectable()
export class LlmService {
  private readonly client: OpenAI;
  private readonly textModel: string;
  private readonly imageModel: string;

  constructor(config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.get<string>("OPENAI_API_KEY") });
    this.textModel = config.get<string>("OPENAI_TEXT_MODEL") ?? "gpt-5.5";
    this.imageModel = config.get<string>("OPENAI_IMAGE_MODEL") ?? "gpt-image-2";
  }

  private interviewContext(project: Project): string {
    const answered = project.rounds
      .flatMap((r) => r.answers)
      .map((a) => `Q: ${a.questionText}\nA: ${a.answer}`)
      .join("\n\n");
    return [
      `웹툰 주제: ${project.topic}`,
      `예시 이미지 ${project.exampleImages.length}장이 화풍 레퍼런스로 제공됨.`,
      answered ? `지금까지의 인터뷰:\n${answered}` : "아직 답변된 질문 없음.",
    ].join("\n\n");
  }

  private async structured<T>(args: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<T> {
    const res = await this.client.responses.create({
      model: this.textModel,
      instructions: args.system,
      input: args.user,
      text: {
        format: {
          type: "json_schema",
          name: args.schemaName,
          strict: true,
          schema: args.schema,
        },
      },
    });
    return JSON.parse(res.output_text) as T;
  }

  async generateQuestions(project: Project): Promise<Question[]> {
    const round = project.rounds.length + 1;
    const out = await this.structured<{ questions: Question[] }>({
      system:
        "당신은 웹툰 기획 전문 에디터다. 사용자의 주제와 지금까지의 답변을 바탕으로, " +
        "스토리보드를 구체화하기 위해 꼭 필요한 질문을 3~5개 생성하라. " +
        "각 질문에는 선택지 2~4개를 제시하고 자유 답변도 허용하라. " +
        "이미 답변된 내용은 다시 묻지 마라. 질문은 한국어로 작성하라. " +
        `현재 ${round}번째 질문 라운드다. 라운드가 거듭될수록 더 구체적인 질문(전개, 결말, 화 수, 연출)을 하라.`,
      user: this.interviewContext(project),
      schemaName: "interview_questions",
      schema: QUESTIONS_SCHEMA as unknown as Record<string, unknown>,
    });
    return out.questions.map((q, i) => ({
      ...q,
      id: `r${round}q${i + 1}`,
      options: q.options.map((o, j) => ({ ...o, id: `r${round}q${i + 1}o${j + 1}` })),
    }));
  }

  async generateStoryboard(project: Project): Promise<Storyboard> {
    return this.structured<Storyboard>({
      system:
        "당신은 웹툰 기획 전문 작가다. 주제와 인터뷰 내용을 바탕으로 전체 스토리보드를 작성하라. " +
        "제목, 로그라인, 장르, 화풍(artStyle, 예시 이미지 기반의 그림체 묘사), 주요 등장인물, " +
        "그리고 화(episode)별 줄거리를 작성하라. 답변에서 화 수가 언급되면 따르고, 없으면 4~8화로 구성하라. " +
        "모든 텍스트는 한국어로 작성하라.",
      user: this.interviewContext(project),
      schemaName: "storyboard",
      schema: STORYBOARD_SCHEMA as unknown as Record<string, unknown>,
    });
  }

  async generateEpisodeDetail(project: Project, episodeIndex: number): Promise<EpisodeDetail> {
    const sb = project.storyboard;
    if (!sb) throw new Error("storyboard not generated yet");
    const ep = sb.episodes.find((e) => e.index === episodeIndex);
    if (!ep) throw new Error(`episode ${episodeIndex} not in storyboard`);

    return this.structured<EpisodeDetail>({
      system:
        "당신은 웹툰 콘티 작가다. 스토리보드와 해당 화 줄거리를 바탕으로 한 화를 구체화하라. " +
        "scenario에는 그 화의 상세 시나리오를 쓰고, panels에는 컷(패널) 단위로 6~12개를 작성하라. " +
        "각 패널의 imagePrompt는 이미지 생성 모델에 넘길 영어 프롬프트로, " +
        `화풍(${sb.artStyle})과 등장인물 외형 묘사를 일관되게 포함하라. ` +
        "description과 dialogue는 한국어로 작성하라.",
      user: [
        `스토리보드 전체:\n${JSON.stringify(sb, null, 2)}`,
        `구체화할 화: ${ep.index}화 — ${ep.title}\n줄거리: ${ep.synopsis}`,
        this.interviewContext(project),
      ].join("\n\n"),
      schemaName: "episode_detail",
      schema: EPISODE_SCHEMA as unknown as Record<string, unknown>,
    });
  }

  /** Generate a panel image with gpt-image-2, using example images as style reference (edits API). */
  async generatePanelImage(
    project: Project,
    imagePrompt: string,
    outName: string,
  ): Promise<string> {
    const prompt =
      `Webtoon panel, vertical-scroll Korean webtoon style. ${imagePrompt}` +
      (project.storyboard ? ` Art style: ${project.storyboard.artStyle}.` : "") +
      " Match the art style of the reference images exactly.";

    let b64: string | undefined;
    if (project.exampleImages.length > 0) {
      const refs = await Promise.all(
        project.exampleImages.slice(0, 4).map(async (img) => {
          const buf = await fs.readFile(path.join(UPLOADS_DIR, img.filename));
          return toFile(buf, img.filename, { type: "image/png" });
        }),
      );
      const res = await this.client.images.edit({
        model: this.imageModel,
        image: refs,
        prompt,
        size: "1024x1536",
      });
      b64 = res.data?.[0]?.b64_json;
    } else {
      const res = await this.client.images.generate({
        model: this.imageModel,
        prompt,
        size: "1024x1536",
      });
      b64 = res.data?.[0]?.b64_json;
    }

    if (!b64) throw new Error("image generation returned no data");
    await fs.mkdir(GENERATED_DIR, { recursive: true });
    const filename = `${outName}.png`;
    await fs.writeFile(path.join(GENERATED_DIR, filename), Buffer.from(b64, "base64"));
    return `/files/generated/${filename}`;
  }
}
