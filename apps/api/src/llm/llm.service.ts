import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Character, EpisodeDetail, Project, Question, Storyboard } from "@webtoon/shared";
import OpenAI, { toFile } from "openai";

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
  required: ["title", "logline", "genre", "artStyle", "episodes"],
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    genre: { type: "string" },
    artStyle: { type: "string" },
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

const CHARACTERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["characters"],
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "appearance", "imagePrompt"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          appearance: { type: "string" },
          imagePrompt: { type: "string" },
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
        required: ["index", "description", "dialogue", "imagePrompt", "characterNames"],
        properties: {
          index: { type: "integer" },
          description: { type: "string" },
          dialogue: { type: "string" },
          imagePrompt: { type: "string" },
          characterNames: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const EPISODES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["episodes"],
  properties: {
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

export type ProgressFn = (chunk: string) => void;

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

  /** streaming structured output; onProgress receives raw json text deltas */
  private async structured<T>(args: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
    onProgress?: ProgressFn;
  }): Promise<T> {
    const stream = this.client.responses.stream({
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
    let accumulated = "";
    stream.on("response.output_text.delta", (e: { delta: string }) => {
      accumulated += e.delta;
      args.onProgress?.(e.delta);
    });
    const res = await stream.finalResponse();
    const text = res.output_text || accumulated;
    return JSON.parse(text) as T;
  }

  async generateQuestions(project: Project, onProgress?: ProgressFn): Promise<Question[]> {
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
      onProgress,
    });
    return out.questions.map((q, i) => ({
      ...q,
      id: `r${round}q${i + 1}`,
      options: q.options.map((o, j) => ({ ...o, id: `r${round}q${i + 1}o${j + 1}` })),
    }));
  }

  async generateStoryboard(project: Project, onProgress?: ProgressFn): Promise<Storyboard> {
    return this.structured<Storyboard>({
      system:
        "당신은 웹툰 기획 전문 작가다. 주제와 인터뷰 내용을 바탕으로 전체 스토리보드를 작성하라. " +
        "제목, 로그라인, 장르, 화풍(artStyle, 예시 이미지 기반의 그림체 묘사), " +
        "그리고 화(episode)별 줄거리를 작성하라. 답변에서 화 수가 언급되면 따르고, 없으면 4~8화로 구성하라. " +
        "모든 텍스트는 한국어로 작성하라.",
      user: this.interviewContext(project),
      schemaName: "storyboard",
      schema: STORYBOARD_SCHEMA as unknown as Record<string, unknown>,
      onProgress,
    });
  }

  async generateCharacters(
    project: Project,
    onProgress?: ProgressFn,
  ): Promise<Omit<Character, "id" | "imageUrl">[]> {
    const sb = project.storyboard;
    const out = await this.structured<{ characters: Omit<Character, "id" | "imageUrl">[] }>({
      system:
        "당신은 웹툰 캐릭터 디자이너다. 스토리보드를 바탕으로 주요 등장인물 캐릭터 시트를 작성하라. " +
        "name/description(성격·역할, 한국어)/appearance(외형 상세, 한국어)와, " +
        "imagePrompt에는 캐릭터 시트 이미지 생성용 영어 프롬프트를 작성하라. " +
        `imagePrompt에는 반드시 화풍(${sb?.artStyle ?? "웹툰 스타일"})과 전신, 다양한 표정이 보이는 ` +
        "character reference sheet 형식임을 포함하라. 주요 인물 2~5명만.",
      user: [`스토리보드:\n${JSON.stringify(sb, null, 2)}`, this.interviewContext(project)].join(
        "\n\n",
      ),
      schemaName: "characters",
      schema: CHARACTERS_SCHEMA as unknown as Record<string, unknown>,
      onProgress,
    });
    return out.characters;
  }

  async generateEpisodeDetail(
    project: Project,
    episodeIndex: number,
    onProgress?: ProgressFn,
  ): Promise<EpisodeDetail> {
    const sb = project.storyboard;
    if (!sb) throw new Error("storyboard not generated yet");
    const ep = sb.episodes.find((e) => e.index === episodeIndex);
    if (!ep) throw new Error(`episode ${episodeIndex} not in storyboard`);

    const characters = project.characters
      .map((c) => `- ${c.name}: ${c.description} / 외형: ${c.appearance}`)
      .join("\n");

    return this.structured<EpisodeDetail>({
      system:
        "당신은 웹툰 콘티 작가다. 스토리보드와 해당 화 줄거리를 바탕으로 한 화를 구체화하라. " +
        "scenario에는 그 화의 상세 시나리오를 쓰고, panels에는 컷(패널) 단위로 작성하라. " +
        "실제 연재 웹툰 기준으로 한 화는 80~90컷이다. 반드시 80컷 이상 90컷 이하로 작성하라. " +
        "각 패널(컷)은 단 하나의 장면, 단 하나의 순간만 담는다. 여러 순간이나 장면 전환을 한 컷에 넣지 마라. " +
        "각 패널의 imagePrompt는 이미지 생성 모델에 넘길 영어 프롬프트로, " +
        "반드시 한 순간의 단일 장면(a single scene, one moment)만 묘사하고 " +
        "'then', 'after', 'sequence' 같은 시간 흐름 표현을 쓰지 마라. " +
        `화풍(${sb.artStyle})을 일관되게 포함하고, 등장 캐릭터의 외형을 캐릭터 시트와 일치하게 묘사하라. ` +
        "characterNames에는 그 컷에 등장하는 캐릭터 이름을 정확히 적어라(아래 캐릭터 목록의 name과 동일하게). " +
        "description과 dialogue는 한국어로 작성하라.",
      user: [
        `스토리보드 전체:\n${JSON.stringify(sb, null, 2)}`,
        `캐릭터 시트:\n${characters || "(없음)"}`,
        `구체화할 화: ${ep.index}화 — ${ep.title}\n줄거리: ${ep.synopsis}`,
        this.interviewContext(project),
      ].join("\n\n"),
      schemaName: "episode_detail",
      schema: EPISODE_SCHEMA as unknown as Record<string, unknown>,
      onProgress,
    });
  }

  /** revise existing storyboard episodes or extend with new ones, per user instruction */
  async reviseEpisodes(
    project: Project,
    instruction: string,
    onProgress?: ProgressFn,
  ): Promise<{ episodes: Storyboard["episodes"] }> {
    const sb = project.storyboard;
    if (!sb) throw new Error("storyboard not generated yet");
    return this.structured<{ episodes: Storyboard["episodes"] }>({
      system:
        "당신은 웹툰 기획 전문 작가다. 기존 스토리보드의 화 목록을 사용자의 지시에 따라 수정하거나 " +
        "뒤에 새 화를 추가하라. 수정 지시가 없는 화는 그대로 유지하라. " +
        "결과는 전체 화 목록(기존 유지분 포함)을 index 순서대로 반환하라. 한국어로 작성하라.",
      user: [
        `현재 화 목록:\n${JSON.stringify(sb.episodes, null, 2)}`,
        `스토리보드 개요: ${sb.title} — ${sb.logline} (${sb.genre})`,
        `사용자 지시: ${instruction}`,
      ].join("\n\n"),
      schemaName: "revise_episodes",
      schema: EPISODES_SCHEMA as unknown as Record<string, unknown>,
      onProgress,
    });
  }

  /** generate an image; reference images passed as buffers. returns png buffer */
  async generateImage(
    prompt: string,
    references: { buffer: Buffer; name: string }[],
  ): Promise<Buffer> {
    let b64: string | undefined;
    if (references.length > 0) {
      const refs = await Promise.all(
        references.slice(0, 6).map((r) => toFile(r.buffer, r.name, { type: "image/png" })),
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
    return Buffer.from(b64, "base64");
  }
}
