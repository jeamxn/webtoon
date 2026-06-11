export type ProjectPhase = "interview" | "storyboard" | "episodes";

export interface ExampleImage {
  id: string;
  filename: string;
  /** server-relative url, e.g. /files/uploads/<id>.png */
  url: string;
}

export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  text: string;
  /** suggested choices. user can always answer freely instead */
  options: QuestionOption[];
  allowFreeText: boolean;
}

export interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
}

export interface InterviewRound {
  round: number;
  questions: Question[];
  answers: Answer[];
}

export interface Character {
  id: string;
  name: string;
  /** personality, role in story */
  description: string;
  /** visual appearance description, used in image prompts */
  appearance: string;
  /** character sheet image prompt (english) */
  imagePrompt: string;
  /** generated character sheet image url */
  imageUrl?: string;
}

export interface StoryboardEpisode {
  index: number;
  title: string;
  synopsis: string;
}

export interface Storyboard {
  title: string;
  logline: string;
  genre: string;
  artStyle: string;
  episodes: StoryboardEpisode[];
}

export interface Panel {
  index: number;
  /** what happens in this panel */
  description: string;
  /** dialogue / narration text */
  dialogue: string;
  /** prompt used for image generation (english) */
  imagePrompt: string;
  /** names of characters appearing in this panel */
  characterNames: string[];
  /** generated image url, if any */
  imageUrl?: string;
}

export interface EpisodeDetail {
  index: number;
  title: string;
  scenario: string;
  panels: Panel[];
}

export interface Project {
  id: string;
  topic: string;
  exampleImages: ExampleImage[];
  phase: ProjectPhase;
  rounds: InterviewRound[];
  characters: Character[];
  storyboard?: Storyboard;
  episodes: EpisodeDetail[];
  createdAt: string;
  updatedAt: string;
}

/* ---------- background jobs ---------- */

export type JobType =
  | "questions"
  | "storyboard"
  | "characters"
  | "character_image"
  | "episode_detail"
  | "panel_image"
  | "revise_episodes";

export type JobStatus = "pending" | "running" | "done" | "error";

export interface Job {
  id: string;
  projectId: string;
  type: JobType;
  /** e.g. { episodeIndex: 1, panelIndex: 3, characterId: "..." } */
  params: Record<string, unknown>;
  status: JobStatus;
  /** streamed LLM text so far (for live preview) */
  progressText: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** SSE event emitted on /api/projects/:id/events */
export interface ProjectEvent {
  kind: "job_update" | "project_update";
  job?: Job;
  /** present when kind === project_update */
  projectId: string;
  at: string;
}

export interface CreateProjectResponse {
  project: Project;
  job: Job;
}
