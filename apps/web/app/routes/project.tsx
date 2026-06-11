import type { Answer, EpisodeDetail, Project, Question } from "@webtoon/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  addEpisode,
  buildStoryboard,
  detailEpisode,
  editEpisode,
  generateCharacterImage,
  generatePanelImage,
  getProject,
  regenerateCharacters,
  reviseEpisodes,
  submitAnswers,
} from "../api";
import { JobsPanel, useProjectJobs } from "../jobs";

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

function EpisodeEditor({
  initialTitle,
  initialSynopsis,
  onSave,
  onCancel,
}: {
  initialTitle: string;
  initialSynopsis: string;
  onSave: (title: string, synopsis: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [synopsis, setSynopsis] = useState(initialSynopsis);
  return (
    <div style={{ marginTop: 8 }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
      />
      <textarea
        rows={4}
        style={{ marginTop: 6 }}
        value={synopsis}
        onChange={(e) => setSynopsis(e.target.value)}
        placeholder="줄거리"
      />
      <div className="row" style={{ marginTop: 6 }}>
        <button type="button" onClick={() => onSave(title, synopsis)}>
          저장
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [editingEp, setEditingEp] = useState<number | null>(null);
  const [addingEp, setAddingEp] = useState(false);
  const [reviseText, setReviseText] = useState("");

  const refresh = useCallback(() => {
    if (!id) return;
    getProject(id)
      .then(setProject)
      .catch((e) => setError(String(e)));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { active } = useProjectJobs(id, refresh);

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
  const questionsJobRunning = active.some((j) => j.type === "questions");

  const act = (fn: () => Promise<unknown>) => {
    setError(null);
    fn().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const onSubmitAnswers = () =>
    act(async () => {
      const payload: Answer[] = currentQuestions
        .filter((q) => answers[q.id]?.trim())
        .map((q) => ({ questionId: q.id, questionText: q.text, answer: answers[q.id].trim() }));
      await submitAnswers(id, payload);
      setAnswers({});
      refresh();
    });

  const episodeFor = (index: number): EpisodeDetail | undefined =>
    project.episodes.find((e) => e.index === index);

  return (
    <main>
      <JobsPanel jobs={active} />
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
          {questionsJobRunning && currentQuestions.length === 0 && (
            <p className="muted">
              <span className="spinner" /> 질문 생성 중... (작업 패널에서 응답 미리보기)
            </p>
          )}
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
              disabled={answeredCount === 0 || questionsJobRunning}
            >
              답변 제출 → 다음 질문
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => act(() => buildStoryboard(id))}
              disabled={project.rounds.length < 1}
            >
              이만하면 충분, 스토리보드 만들기
            </button>
          </div>
        </>
      )}

      {/* ----- characters ----- */}
      {project.characters.length > 0 && (
        <>
          <div className="row">
            <h2>캐릭터</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => act(() => regenerateCharacters(id))}
            >
              캐릭터 다시 생성
            </button>
          </div>
          <div className="char-grid">
            {project.characters.map((c) => (
              <div key={c.id} className="card" style={{ margin: 0 }}>
                {c.imageUrl ? (
                  <img className="char-img" src={c.imageUrl} alt={c.name} />
                ) : (
                  <div className="char-img placeholder">
                    <span className="spinner" />
                  </div>
                )}
                <strong>{c.name}</strong>
                <p className="muted" style={{ margin: "4px 0" }}>
                  {c.description}
                </p>
                <details>
                  <summary className="muted">외형</summary>
                  <p className="muted">{c.appearance}</p>
                </details>
                <button
                  type="button"
                  className="secondary"
                  style={{ marginTop: 6 }}
                  onClick={() => act(() => generateCharacterImage(id, c.id))}
                >
                  이미지 다시 생성
                </button>
              </div>
            ))}
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
          </div>

          <div className="card">
            <div className="muted">회차 일괄 수정/추가 (AI)</div>
            <textarea
              rows={2}
              style={{ marginTop: 6 }}
              placeholder="예: 3화를 더 코믹하게 바꾸고, 뒤에 에필로그 2화를 추가해줘"
              value={reviseText}
              onChange={(e) => setReviseText(e.target.value)}
            />
            <div className="row" style={{ marginTop: 6 }}>
              <button
                type="button"
                disabled={!reviseText.trim()}
                onClick={() =>
                  act(async () => {
                    await reviseEpisodes(id, reviseText.trim());
                    setReviseText("");
                  })
                }
              >
                AI로 회차 수정/추가
              </button>
              <button type="button" className="secondary" onClick={() => setAddingEp(true)}>
                직접 회차 추가
              </button>
            </div>
            {addingEp && (
              <EpisodeEditor
                initialTitle=""
                initialSynopsis=""
                onSave={(title, synopsis) =>
                  act(async () => {
                    await addEpisode(id, { title, synopsis });
                    setAddingEp(false);
                    refresh();
                  })
                }
                onCancel={() => setAddingEp(false)}
              />
            )}
          </div>

          {project.storyboard.episodes.map((ep) => {
            const detail = episodeFor(ep.index);
            const detailJob = active.find(
              (j) => j.type === "episode_detail" && Number(j.params.episodeIndex) === ep.index,
            );
            return (
              <div key={ep.index} className="card">
                <div className="row">
                  <strong>
                    {ep.index}화 — {ep.title}
                  </strong>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingEp(editingEp === ep.index ? null : ep.index)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => act(() => detailEpisode(id, ep.index))}
                    disabled={!!detailJob}
                  >
                    {detailJob ? "구체화 중..." : detail ? "다시 구체화" : "이 화 구체화하기"}
                  </button>
                </div>
                <p className="muted">{ep.synopsis}</p>

                {editingEp === ep.index && (
                  <EpisodeEditor
                    initialTitle={ep.title}
                    initialSynopsis={ep.synopsis}
                    onSave={(title, synopsis) =>
                      act(async () => {
                        await editEpisode(id, ep.index, { title, synopsis });
                        setEditingEp(null);
                        refresh();
                      })
                    }
                    onCancel={() => setEditingEp(null)}
                  />
                )}

                {detail && (
                  <>
                    <details>
                      <summary className="muted">시나리오 전문 ({detail.panels.length}컷)</summary>
                      <p style={{ whiteSpace: "pre-wrap" }}>{detail.scenario}</p>
                    </details>
                    {detail.panels.map((panel) => {
                      const panelJob = active.find(
                        (j) =>
                          j.type === "panel_image" &&
                          Number(j.params.episodeIndex) === ep.index &&
                          Number(j.params.panelIndex) === panel.index,
                      );
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
                            {panel.characterNames?.length > 0 && (
                              <span className="muted">{panel.characterNames.join(", ")}</span>
                            )}
                            <button
                              type="button"
                              className="secondary"
                              onClick={() =>
                                act(() => generatePanelImage(id, ep.index, panel.index))
                              }
                              disabled={!!panelJob}
                            >
                              {panelJob
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
                              loading="lazy"
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
