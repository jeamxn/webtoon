import type { Answer, EpisodeDetail, Project, Question } from "@webtoon/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  buildStoryboard,
  detailEpisode,
  generatePanelImage,
  getProject,
  submitAnswers,
} from "../api";

function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (v: string) => void;
}) {
  const selectedOption = question.options.find((o) => o.label === value);
  return (
    <div className="card">
      <strong>{question.text}</strong>
      <div style={{ marginTop: 8 }}>
        {question.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`option${selectedOption?.id === o.id ? " selected" : ""}`}
            onClick={() => onChange(o.label)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {question.allowFreeText && (
        <input
          type="text"
          style={{ marginTop: 8 }}
          placeholder="직접 입력..."
          value={selectedOption ? "" : value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!id) return;
    getProject(id)
      .then(setProject)
      .catch((e) => setError(String(e)));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!id) return null;
  if (!project)
    return (
      <main>
        <p className="muted">불러오는 중... {error}</p>
      </main>
    );

  const currentRound = project.rounds.at(-1);
  const currentQuestions =
    project.phase === "interview" && currentRound && currentRound.answers.length === 0
      ? currentRound.questions
      : [];
  const answeredCount = currentQuestions.filter((q) => answers[q.id]?.trim()).length;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSubmitAnswers = () =>
    run("answers", async () => {
      const payload: Answer[] = currentQuestions
        .filter((q) => answers[q.id]?.trim())
        .map((q) => ({ questionId: q.id, questionText: q.text, answer: answers[q.id].trim() }));
      await submitAnswers(id, payload);
      setAnswers({});
    });

  const episodeFor = (index: number): EpisodeDetail | undefined =>
    project.episodes.find((e) => e.index === index);

  return (
    <main>
      <p>
        <Link to="/">← 홈</Link>
      </p>
      <div className="row">
        <h1 style={{ margin: 0 }}>{project.storyboard?.title ?? project.topic}</h1>
        <span className="badge">{project.phase}</span>
      </div>
      <p className="muted">주제: {project.topic}</p>
      {project.exampleImages.length > 0 && (
        <div className="thumbs">
          {project.exampleImages.map((img) => (
            <img key={img.id} src={img.url} alt="예시" />
          ))}
        </div>
      )}
      {error && <p style={{ color: "#ff7a7a" }}>{error}</p>}

      {/* ----- interview phase ----- */}
      {project.phase === "interview" && (
        <>
          <h2>질문에 답해주세요 (라운드 {project.rounds.length})</h2>
          {project.rounds.slice(0, -1).map((r) => (
            <details key={r.round} className="card">
              <summary className="muted">라운드 {r.round} 답변 보기</summary>
              {r.answers.map((a) => (
                <p key={a.questionId}>
                  <span className="muted">{a.questionText}</span>
                  <br />→ {a.answer}
                </p>
              ))}
            </details>
          ))}
          {currentQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              value={answers[q.id] ?? ""}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            />
          ))}
          <div className="row">
            <button
              type="button"
              onClick={onSubmitAnswers}
              disabled={busy !== null || answeredCount === 0}
            >
              {busy === "answers" ? "다음 질문 생성 중..." : "답변 제출 → 다음 질문"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => run("storyboard", () => buildStoryboard(id))}
              disabled={busy !== null || project.rounds.length < 2}
            >
              {busy === "storyboard" ? "스토리보드 생성 중..." : "이만하면 충분, 스토리보드 만들기"}
            </button>
            {busy && <span className="spinner" />}
          </div>
        </>
      )}

      {/* ----- storyboard / episodes ----- */}
      {project.storyboard && (
        <>
          <h2>스토리보드</h2>
          <div className="card">
            <p>
              <strong>{project.storyboard.title}</strong> — {project.storyboard.logline}
            </p>
            <p className="muted">
              장르: {project.storyboard.genre} · 화풍: {project.storyboard.artStyle}
            </p>
            <p className="muted">
              등장인물:{" "}
              {project.storyboard.characters.map((c) => `${c.name}(${c.description})`).join(", ")}
            </p>
          </div>

          {project.storyboard.episodes.map((ep) => {
            const detail = episodeFor(ep.index);
            const key = `ep${ep.index}`;
            return (
              <div key={ep.index} className="card">
                <div className="row">
                  <strong>
                    {ep.index}화 — {ep.title}
                  </strong>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => run(key, () => detailEpisode(id, ep.index))}
                    disabled={busy !== null}
                  >
                    {busy === key ? "구체화 중..." : detail ? "다시 구체화" : "이 화 구체화하기"}
                  </button>
                </div>
                <p className="muted">{ep.synopsis}</p>

                {detail && (
                  <>
                    <details>
                      <summary className="muted">시나리오 전문</summary>
                      <p style={{ whiteSpace: "pre-wrap" }}>{detail.scenario}</p>
                    </details>
                    {detail.panels.map((panel) => {
                      const pkey = `${key}p${panel.index}`;
                      return (
                        <div
                          key={panel.index}
                          style={{
                            borderTop: "1px solid var(--border)",
                            marginTop: 12,
                            paddingTop: 12,
                          }}
                        >
                          <div className="row">
                            <span className="badge">컷 {panel.index}</span>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() =>
                                run(pkey, () => generatePanelImage(id, ep.index, panel.index))
                              }
                              disabled={busy !== null}
                            >
                              {busy === pkey
                                ? "그리는 중..."
                                : panel.imageUrl
                                  ? "다시 그리기"
                                  : "이 컷 그리기"}
                            </button>
                          </div>
                          <p>{panel.description}</p>
                          {panel.dialogue && <p className="muted">💬 {panel.dialogue}</p>}
                          {panel.imageUrl && (
                            <img
                              className="panel-img"
                              src={panel.imageUrl}
                              alt={panel.description}
                            />
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}
