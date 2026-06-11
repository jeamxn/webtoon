export type ProjectPhase = "interview" | "storyboard" | "episodes";

export interface ExampleImage {
  id: string;
  filename: string;
  /** server-relative url, e.g. /uploads/<id>.png */
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
  characters: { name: string; description: string }[];
  episodes: StoryboardEpisode[];
}

export interface Panel {
  index: number;
  /** what happens in this panel */
  description: string;
  /** dialogue / narration text */
  dialogue: string;
  /** prompt used for image generation */
  imagePrompt: string;
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
  storyboard?: Storyboard;
  episodes: EpisodeDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectResponse {
  project: Project;
  questions: Question[];
}
