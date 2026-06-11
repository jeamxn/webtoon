import type { Answer, Job, Project, ProjectEvent } from "@webtoon/shared";

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

export function listJobs(id: string, activeOnly = false): Promise<Job[]> {
  return fetch(`/api/projects/${id}/jobs${activeOnly ? "?active=1" : ""}`).then((r) =>
    json<Job[]>(r),
  );
}

export function createProject(
  topic: string,
  images: File[],
): Promise<{ project: Project; job: Job }> {
  const fd = new FormData();
  fd.set("topic", topic);
  for (const img of images) fd.append("images", img);
  return fetch("/api/projects", { method: "POST", body: fd }).then((r) =>
    json<{ project: Project; job: Job }>(r),
  );
}

export function submitAnswers(
  id: string,
  answers: Answer[],
): Promise<{ project: Project; job: Job }> {
  return fetch(`/api/projects/${id}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  }).then((r) => json<{ project: Project; job: Job }>(r));
}

export function buildStoryboard(id: string): Promise<Job> {
  return fetch(`/api/projects/${id}/storyboard`, { method: "POST" }).then((r) => json<Job>(r));
}

export function regenerateCharacters(id: string): Promise<Job> {
  return fetch(`/api/projects/${id}/characters`, { method: "POST" }).then((r) => json<Job>(r));
}

export function generateCharacterImage(id: string, characterId: string): Promise<Job> {
  return fetch(`/api/projects/${id}/characters/${characterId}/image`, { method: "POST" }).then(
    (r) => json<Job>(r),
  );
}

export function detailEpisode(id: string, index: number): Promise<Job> {
  return fetch(`/api/projects/${id}/episodes/${index}`, { method: "POST" }).then((r) =>
    json<Job>(r),
  );
}

export function editEpisode(
  id: string,
  index: number,
  patch: { title?: string; synopsis?: string },
): Promise<Project> {
  return fetch(`/api/projects/${id}/episodes/${index}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => json<Project>(r));
}

export function addEpisode(
  id: string,
  body: { title?: string; synopsis?: string },
): Promise<Project> {
  return fetch(`/api/projects/${id}/episodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json<Project>(r));
}

export function reviseEpisodes(id: string, instruction: string): Promise<Job> {
  return fetch(`/api/projects/${id}/episodes-revise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction }),
  }).then((r) => json<Job>(r));
}

export function generatePanelImage(
  id: string,
  episodeIndex: number,
  panelIndex: number,
): Promise<Job> {
  return fetch(`/api/projects/${id}/episodes/${episodeIndex}/panels/${panelIndex}/image`, {
    method: "POST",
  }).then((r) => json<Job>(r));
}

export function generatePanelImages(
  id: string,
  episodeIndex: number,
  panels: number[],
): Promise<Job[]> {
  return fetch(`/api/projects/${id}/episodes/${episodeIndex}/panels-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ panels }),
  }).then((r) => json<Job[]>(r));
}

/** subscribe to project SSE events; returns cleanup fn */
export function subscribeEvents(id: string, onEvent: (e: ProjectEvent) => void): () => void {
  const es = new EventSource(`/api/projects/${id}/events`);
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as ProjectEvent);
    } catch {
      // ignore malformed events
    }
  };
  return () => es.close();
}
