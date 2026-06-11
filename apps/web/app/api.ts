import type {
  Answer,
  CreateProjectResponse,
  EpisodeDetail,
  Project,
  Question,
} from "@webtoon/shared";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export function listProjects(): Promise<Project[]> {
  return fetch("/api/projects").then((r) => json<Project[]>(r));
}

export function getProject(id: string): Promise<Project> {
  return fetch(`/api/projects/${id}`).then((r) => json<Project>(r));
}

export function createProject(topic: string, images: File[]): Promise<CreateProjectResponse> {
  const fd = new FormData();
  fd.set("topic", topic);
  for (const img of images) fd.append("images", img);
  return fetch("/api/projects", { method: "POST", body: fd }).then((r) =>
    json<CreateProjectResponse>(r),
  );
}

export function submitAnswers(
  id: string,
  answers: Answer[],
): Promise<{ project: Project; questions: Question[] }> {
  return fetch(`/api/projects/${id}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  }).then((r) => json<{ project: Project; questions: Question[] }>(r));
}

export function buildStoryboard(id: string): Promise<Project> {
  return fetch(`/api/projects/${id}/storyboard`, { method: "POST" }).then((r) => json<Project>(r));
}

export function detailEpisode(id: string, index: number): Promise<EpisodeDetail> {
  return fetch(`/api/projects/${id}/episodes/${index}`, { method: "POST" }).then((r) =>
    json<EpisodeDetail>(r),
  );
}

export function generatePanelImage(
  id: string,
  episodeIndex: number,
  panelIndex: number,
): Promise<EpisodeDetail> {
  return fetch(`/api/projects/${id}/episodes/${episodeIndex}/panels/${panelIndex}/image`, {
    method: "POST",
  }).then((r) => json<EpisodeDetail>(r));
}
