import type { Job, ProjectEvent } from "@webtoon/shared";
import { useEffect, useMemo, useState } from "react";
import { listJobs, subscribeEvents } from "./api";

const TYPE_LABEL: Record<string, string> = {
  questions: "질문 생성",
  storyboard: "스토리보드",
  characters: "캐릭터 설정",
  character_image: "캐릭터 이미지",
  episode_detail: "화 구체화",
  panel_image: "컷 이미지",
  revise_episodes: "회차 수정",
};

export function jobLabel(job: Job): string {
  const base = TYPE_LABEL[job.type] ?? job.type;
  const ep = job.params.episodeIndex ? `${job.params.episodeIndex}화` : "";
  const panel = job.params.panelIndex ? ` ${job.params.panelIndex}컷` : "";
  return `${base} ${ep}${panel}`.trim();
}

/** live job state for a project: SSE-driven, falls back to initial fetch */
export function useProjectJobs(projectId: string | undefined, onProjectUpdate: () => void) {
  const [jobs, setJobs] = useState<Record<string, Job>>({});

  useEffect(() => {
    if (!projectId) return;
    listJobs(projectId).then((list) => {
      setJobs(Object.fromEntries(list.map((j) => [j.id, j])));
    });
    const off = subscribeEvents(projectId, (e: ProjectEvent) => {
      if (e.kind === "job_update" && e.job) {
        const job = e.job;
        setJobs((prev) => ({ ...prev, [job.id]: job }));
      }
      if (e.kind === "project_update") onProjectUpdate();
    });
    return off;
  }, [projectId, onProjectUpdate]);

  const all = useMemo(
    () => Object.values(jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobs],
  );
  const active = useMemo(
    () => all.filter((j) => j.status === "pending" || j.status === "running"),
    [all],
  );
  return { all, active };
}

/** floating panel showing running jobs and their streamed LLM output */
export function JobsPanel({ jobs }: { jobs: Job[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (jobs.length === 0) return null;
  return (
    <div className="jobs-panel">
      <div className="muted" style={{ marginBottom: 6 }}>
        진행 중인 작업 {jobs.length}개
      </div>
      {jobs.map((job) => (
        <div key={job.id} className="job-item">
          <button
            type="button"
            className="job-head"
            onClick={() => setOpenId(openId === job.id ? null : job.id)}
          >
            <span className="spinner" />
            <span>{jobLabel(job)}</span>
            <span className="muted" style={{ marginLeft: "auto" }}>
              {job.progressText.length > 0 ? `${job.progressText.length}자` : "대기"}
            </span>
          </button>
          {openId === job.id && (
            <pre className="job-stream">{job.progressText || "(응답 대기 중...)"}</pre>
          )}
        </div>
      ))}
    </div>
  );
}
