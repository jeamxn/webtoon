import { CheckCircleFilled, LoadingOutlined } from "@ant-design/icons";
import type { Job, ProjectEvent } from "@webtoon/shared";
import { Badge, Card, Collapse, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
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

interface DisplayJob extends Job {
  isCompleted?: boolean;
  completedAt?: number;
}

/** Smooth typing effect terminal for LLM streams */
function TypingTerminal({ text, isCompleted }: { text: string; isCompleted?: boolean }) {
  const [displayedText, setDisplayedText] = useState("");
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!text) {
      setDisplayedText("");
      return;
    }

    let timer: number;
    const step = () => {
      setDisplayedText((prev) => {
        if (prev.length >= text.length) {
          return prev;
        }
        const diff = text.length - prev.length;
        // 스트리밍 속도 동적 조절: 버퍼가 많이 쌓이면 더 빠르게 타이핑
        const charsToAdd = diff > 30 ? Math.ceil(diff / 4) : diff > 10 ? 2 : 1;
        return prev + text.slice(prev.length, prev.length + charsToAdd);
      });
      timer = requestAnimationFrame(step);
    };

    timer = requestAnimationFrame(step);
    return () => cancelAnimationFrame(timer);
  }, [text]);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, []);

  return (
    <pre ref={preRef} className={`terminal-stream ${!isCompleted ? "typing-cursor" : ""}`}>
      {displayedText || "(응답 대기 중...)"}
    </pre>
  );
}

/** floating panel showing running jobs and their streamed LLM output */
export function JobsPanel({ jobs }: { jobs: Job[] }) {
  const [displayJobs, setDisplayJobs] = useState<Record<string, DisplayJob>>({});

  // 실시간 작업 상태 동기화 및 완료 트랜지션 관리
  useEffect(() => {
    setDisplayJobs((prev) => {
      const next = { ...prev };
      const now = Date.now();

      // 활성 작업 추가 및 업데이트
      for (const job of jobs) {
        next[job.id] = {
          ...job,
          isCompleted: false,
        };
      }

      // 더 이상 활성 상태가 아닌 작업은 완료 처리하여 4초간 유지
      const activeIds = new Set(jobs.map((j) => j.id));
      for (const id in next) {
        if (!activeIds.has(id) && !next[id].isCompleted) {
          next[id] = {
            ...next[id],
            status: "done",
            isCompleted: true,
            completedAt: now,
          };
        }
      }

      return next;
    });
  }, [jobs]);

  // 완료된 작업 4초 후 자동 소멸 처리
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDisplayJobs((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id in next) {
          if (next[id].isCompleted && next[id].completedAt) {
            if (now - next[id].completedAt > 4000) {
              delete next[id];
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sortedJobs = useMemo(() => {
    return Object.values(displayJobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [displayJobs]);

  if (sortedJobs.length === 0) return null;

  const activeCount = sortedJobs.filter((j) => !j.isCompleted).length;

  return (
    <div className="jobs-float">
      <Card
        size="small"
        className="cyber-panel"
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#f8fafc" }}>
            <Badge status={activeCount > 0 ? "processing" : "default"} color="#38bdf8" />
            <span style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
              실시간 작업 스트리밍 ({activeCount}개 진행 중)
            </span>
          </span>
        }
        styles={{ body: { maxHeight: "45vh", overflowY: "auto", padding: 8 } }}
      >
        <Collapse
          ghost
          size="small"
          className="cyber-collapse"
          items={sortedJobs.map((job, index) => {
            const isCompleted = job.isCompleted;
            return {
              key: job.id,
              label: (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    animationDelay: `${index * 0.05}s`,
                  }}
                  className="fade-in-stagger"
                >
                  {isCompleted ? (
                    <CheckCircleFilled className="pop-checkmark" style={{ fontSize: 15 }} />
                  ) : (
                    <LoadingOutlined spin style={{ color: "#38bdf8" }} />
                  )}
                  <span
                    style={{
                      fontWeight: 600,
                      color: isCompleted ? "#a7f3d0" : "#f8fafc",
                      textShadow: isCompleted ? "0 0 8px rgba(52, 211, 153, 0.2)" : "none",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {jobLabel(job)}
                  </span>
                  <Typography.Text
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: isCompleted ? "#34d399" : "#94a3b8",
                    }}
                  >
                    {isCompleted
                      ? "완료"
                      : job.progressText.length > 0
                        ? `${job.progressText.length}자`
                        : "대기"}
                  </Typography.Text>
                </span>
              ),
              children: <TypingTerminal text={job.progressText} isCompleted={isCompleted} />,
            };
          })}
        />
      </Card>
    </div>
  );
}
