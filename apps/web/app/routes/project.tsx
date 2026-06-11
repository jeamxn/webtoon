import {
  AppstoreOutlined,
  CheckCircleOutlined,
  EditOutlined,
  HomeOutlined,
  LoadingOutlined,
  MobileOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { Answer, EpisodeDetail, Job, Project, Question } from "@webtoon/shared";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Empty,
  Flex,
  Image,
  Input,
  Modal,
  Radio,
  Row,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  addEpisode,
  buildStoryboard,
  detailEpisode,
  editEpisode,
  generateCharacterImage,
  generatePanelImage,
  generatePanelImages,
  getProject,
  regenerateCharacters,
  reviseEpisodes,
  submitAnswers,
} from "../api";
import { JobsPanel, useProjectJobs } from "../jobs";

const { Text, Title, Paragraph } = Typography;

interface Panel {
  index: number;
  description: string;
  dialogue?: string;
  imageUrl?: string;
  characterNames?: string[];
}

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
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
      {/* AI 질문 버블 */}
      <div className="ai-question-bubble">
        <Flex align="center" gap={6} style={{ marginBottom: 6 }}>
          <ThunderboltOutlined style={{ color: "var(--primary)" }} />
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
            AI WEBTOON ASSISTANT
          </Text>
        </Flex>
        <Text strong style={{ fontSize: 15, color: "var(--text-primary)" }}>
          {question.text}
        </Text>
      </div>

      {/* 사용자 답변 옵션 */}
      <div className="user-answer-container">
        {question.options.map((opt) => {
          const isSelected = value === opt.label;
          return (
            <button
              type="button"
              key={opt.id}
              className={`user-option-card btn-compress ${isSelected ? "selected" : ""}`}
              onClick={() => onChange(opt.label)}
              style={{ textAlign: "left", width: "100%" }}
            >
              <Radio checked={isSelected} style={{ pointerEvents: "none" }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{opt.label}</span>
              </Radio>
            </button>
          );
        })}
        {question.allowFreeText && (
          <Input
            className="glow-focus"
            style={{ borderRadius: 12, height: 42, marginTop: 4 }}
            placeholder="직접 상세히 입력하기..."
            value={selectedOption ? "" : value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

function EpisodeEditorModal({
  open,
  title: heading,
  initialTitle,
  initialSynopsis,
  onSave,
  onCancel,
}: {
  open: boolean;
  title: string;
  initialTitle: string;
  initialSynopsis: string;
  onSave: (title: string, synopsis: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [synopsis, setSynopsis] = useState(initialSynopsis);
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setSynopsis(initialSynopsis);
    }
  }, [open, initialTitle, initialSynopsis]);
  return (
    <Modal
      open={open}
      title={
        <span className="text-gradient" style={{ fontSize: 18 }}>
          {heading}
        </span>
      }
      okText="저장"
      cancelText="취소"
      onOk={() => onSave(title, synopsis)}
      onCancel={onCancel}
      okButtonProps={{ className: "btn-primary-gradient btn-compress", style: { borderRadius: 8 } }}
      cancelButtonProps={{
        className: "btn-secondary-ghost btn-compress",
        style: { borderRadius: 8 },
      }}
      modalRender={(modal) => (
        <div
          className="glass-card"
          style={{ background: "var(--glass-bg)", borderRadius: 16, overflow: "hidden" }}
        >
          {modal}
        </div>
      )}
    >
      <Space direction="vertical" style={{ width: "100%", marginTop: 16 }} size={14}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: "block" }}>
            에피소드 제목
          </Text>
          <Input
            className="glow-focus"
            style={{ borderRadius: 10, height: 40 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: "block" }}>
            줄거리 (시놉시스)
          </Text>
          <Input.TextArea
            className="glow-focus"
            style={{ borderRadius: 10 }}
            rows={5}
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            placeholder="줄거리를 상세히 입력하세요"
          />
        </div>
      </Space>
    </Modal>
  );
}

function PanelGridShowcase({
  panels,
  episodeIndex,
  activeJobs,
  onGenerateImage,
  onGenerateImages,
}: {
  panels: Panel[];
  episodeIndex: number;
  activeJobs: Job[];
  onGenerateImage: (episodeIndex: number, panelIndex: number) => void;
  onGenerateImages: (episodeIndex: number, panelIndexes: number[]) => void;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "mobile">("grid");
  const [selected, setSelected] = useState<number[]>([]);

  const generatingSet = new Set(
    activeJobs
      .filter((j) => j.type === "panel_image" && Number(j.params.episodeIndex) === episodeIndex)
      .map((j) => Number(j.params.panelIndex)),
  );
  const selectable = panels.filter((p) => !generatingSet.has(p.index));
  const allSelected = selectable.length > 0 && selected.length === selectable.length;
  const missingIndexes = panels
    .filter((p) => !p.imageUrl && !generatingSet.has(p.index))
    .map((p) => p.index);

  const toggle = (panelIndex: number, checked: boolean) =>
    setSelected((prev) =>
      checked ? [...new Set([...prev, panelIndex])] : prev.filter((n) => n !== panelIndex),
    );

  const runBatch = (indexes: number[]) => {
    if (indexes.length === 0) return;
    onGenerateImages(episodeIndex, indexes);
    setSelected([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Flex align="center" gap={12} wrap>
          <Text strong style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            컷 리스트
          </Text>
          <Checkbox
            checked={allSelected}
            indeterminate={selected.length > 0 && !allSelected}
            onChange={(e) => setSelected(e.target.checked ? selectable.map((p) => p.index) : [])}
          >
            전체 선택
          </Checkbox>
          <Button
            size="small"
            type="primary"
            icon={<PictureOutlined />}
            disabled={selected.length === 0}
            onClick={() => runBatch(selected)}
            className="btn-primary-gradient"
          >
            선택한 {selected.length}컷 생성
          </Button>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            disabled={missingIndexes.length === 0}
            onClick={() => runBatch(missingIndexes)}
            className="btn-secondary-ghost"
          >
            안 그린 컷 전부 생성 ({missingIndexes.length})
          </Button>
        </Flex>
        <Radio.Group
          size="small"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="grid">
            <AppstoreOutlined /> 그리드 뷰
          </Radio.Button>
          <Radio.Button value="mobile">
            <MobileOutlined /> 모바일 시뮬레이터
          </Radio.Button>
        </Radio.Group>
      </Flex>

      {viewMode === "mobile" ? (
        <div className="simulator-view">
          <div style={{ maxHeight: "600px", overflowY: "auto", paddingRight: 4 }}>
            {panels.map((panel) => {
              const panelJob = activeJobs.find(
                (j) =>
                  j.type === "panel_image" &&
                  Number(j.params.episodeIndex) === episodeIndex &&
                  Number(j.params.panelIndex) === panel.index,
              );
              const isGenerating = !!panelJob;

              return (
                <div key={panel.index} className="panel-card-wrapper">
                  {panel.imageUrl ? (
                    <img
                      src={panel.imageUrl}
                      alt={panel.description}
                      style={{ width: "100%", display: "block", borderRadius: 12 }}
                    />
                  ) : (
                    <div
                      className="shimmer-aura"
                      style={{
                        width: "100%",
                        aspectRatio: "16/9",
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <Button
                        type="primary"
                        icon={isGenerating ? <LoadingOutlined /> : <PictureOutlined />}
                        loading={isGenerating}
                        onClick={() => onGenerateImage(episodeIndex, panel.index)}
                        className="btn-primary-gradient"
                      >
                        {isGenerating ? "그리는 중..." : "컷 이미지 생성"}
                      </Button>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="panel-info-overlay">
                    <Tag color="blue" style={{ width: "fit-content", marginBottom: 8 }}>
                      컷 {panel.index}
                    </Tag>
                    <Paragraph
                      style={{ color: "#fff", fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}
                    >
                      {panel.description}
                    </Paragraph>
                    {panel.dialogue && (
                      <Text style={{ color: "var(--secondary)", fontSize: 13, fontWeight: 600 }}>
                        💬 {panel.dialogue}
                      </Text>
                    )}
                    {panel.characterNames && panel.characterNames.length > 0 && (
                      <div style={{ marginTop: 12, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {panel.characterNames.map((name) => (
                          <Tag key={name} color="purple" style={{ fontSize: 10 }}>
                            {name}
                          </Tag>
                        ))}
                      </div>
                    )}
                    {panel.imageUrl && (
                      <Button
                        size="small"
                        icon={<PictureOutlined />}
                        loading={isGenerating}
                        onClick={() => onGenerateImage(episodeIndex, panel.index)}
                        style={{ marginTop: 12, width: "fit-content" }}
                        className="btn-secondary-ghost"
                      >
                        다시 그리기
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {panels.map((panel) => {
            const panelJob = activeJobs.find(
              (j) =>
                j.type === "panel_image" &&
                Number(j.params.episodeIndex) === episodeIndex &&
                Number(j.params.panelIndex) === panel.index,
            );
            const isGenerating = !!panelJob;

            return (
              <Col key={panel.index} xs={24} sm={12}>
                <div className="panel-card-wrapper" style={{ height: "100%" }}>
                  <Card
                    className="glass-card"
                    size="small"
                    style={{ height: "100%" }}
                    cover={
                      panel.imageUrl ? (
                        <Image
                          src={panel.imageUrl}
                          alt={panel.description}
                          style={{
                            objectFit: "cover",
                            height: 180,
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                          }}
                        />
                      ) : (
                        <div
                          className="shimmer-aura"
                          style={{
                            height: 180,
                            display: "grid",
                            placeItems: "center",
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                          }}
                        >
                          <Button
                            type="primary"
                            icon={isGenerating ? <LoadingOutlined /> : <PictureOutlined />}
                            loading={isGenerating}
                            onClick={() => onGenerateImage(episodeIndex, panel.index)}
                            className="btn-primary-gradient"
                          >
                            {isGenerating ? "그리는 중..." : "컷 이미지 생성"}
                          </Button>
                        </div>
                      )
                    }
                  >
                    <Card.Meta
                      title={
                        <Flex align="center" justify="space-between">
                          <Flex align="center" gap={6}>
                            <Checkbox
                              checked={selected.includes(panel.index)}
                              disabled={isGenerating}
                              onChange={(e) => toggle(panel.index, e.target.checked)}
                            />
                            <Tag color="geekblue">컷 {panel.index}</Tag>
                          </Flex>
                          {panel.imageUrl && (
                            <Button
                              size="small"
                              type="text"
                              icon={<PictureOutlined />}
                              loading={isGenerating}
                              onClick={() => onGenerateImage(episodeIndex, panel.index)}
                              className="btn-secondary-ghost"
                            >
                              다시 그리기
                            </Button>
                          )}
                        </Flex>
                      }
                      description={
                        <div
                          style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}
                        >
                          <Paragraph
                            ellipsis={{ rows: 2, expandable: true, symbol: "더 보기" }}
                            style={{ fontSize: 12, margin: 0 }}
                          >
                            {panel.description}
                          </Paragraph>
                          {panel.dialogue && (
                            <Text type="secondary" style={{ fontSize: 12, fontStyle: "italic" }}>
                              💬 {panel.dialogue}
                            </Text>
                          )}
                          {panel.characterNames && panel.characterNames.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {panel.characterNames.map((name) => (
                                <Tag key={name} style={{ fontSize: 10, borderRadius: 4 }}>
                                  {name}
                                </Tag>
                              ))}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </Card>
                </div>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}

const PHASE_STEP: Record<string, number> = { interview: 0, storyboard: 1, episodes: 2 };

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
      <main className="page">
        <Flex justify="center" style={{ padding: 80 }}>
          <Spin size="large" tip={error ?? undefined} />
        </Flex>
      </main>
    );

  const currentRound = project.rounds.at(-1);
  const currentQuestions =
    project.phase === "interview" && currentRound && currentRound.answers.length === 0
      ? currentRound.questions
      : [];
  const answeredCount = currentQuestions.filter((q) => answers[q.id]?.trim()).length;
  const questionsJobRunning = active.some((j) => j.type === "questions");
  const storyboardJobRunning = active.some(
    (j) => j.type === "storyboard" || j.type === "revise_episodes",
  );

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

  const editingEpisode = project.storyboard?.episodes.find((e) => e.index === editingEp);

  return (
    <main className="page">
      <JobsPanel jobs={active} />

      {/* Floating Header & Navigation */}
      <Flex align="center" justify="space-between" wrap style={{ marginBottom: 24 }}>
        <Flex align="center" gap={12}>
          <Link to="/">
            <Button
              size="small"
              icon={<HomeOutlined />}
              className="btn-secondary-ghost btn-compress"
            >
              홈으로
            </Button>
          </Link>
          <Title level={3} style={{ margin: 0, color: "var(--text-primary)" }}>
            {project.storyboard?.title ?? project.topic}
          </Title>
        </Flex>
        <Text type="secondary" style={{ fontSize: 13 }}>
          주제: {project.topic}
        </Text>
      </Flex>

      {project.exampleImages.length > 0 && (
        <Image.PreviewGroup>
          <Flex gap={8} wrap style={{ marginBottom: 24 }}>
            {project.exampleImages.map((img) => (
              <Image
                key={img.id}
                src={img.url}
                alt="예시"
                width={64}
                height={64}
                style={{
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "1px solid var(--glass-border-outer)",
                }}
              />
            ))}
          </Flex>
        </Image.PreviewGroup>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24, borderRadius: 12 }}
        />
      )}

      {/* Split-Pane Bento Layout */}
      <div className="workspace-container">
        {/* Left Sidebar (32%): 정보 허브 & 캐릭터 갤러리 */}
        <aside className="sidebar-left">
          <Card
            className="glass-card"
            size="small"
            title={<span style={{ fontSize: 14, fontWeight: 600 }}>프로젝트 가이드</span>}
          >
            <Paragraph type="secondary" style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>
              AI와 실시간으로 교감하며 작품을 완성해 나가는 공간입니다. 왼쪽 패널에서 캐릭터
              일관성을 유지하고, 오른쪽에서 단계별 작업을 수행하세요.
            </Paragraph>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Flex align="center" justify="space-between">
              <Text strong style={{ fontSize: 14, color: "var(--text-primary)" }}>
                캐릭터 프로필 ({project.characters.length})
              </Text>
              {project.characters.length > 0 && (
                <Button
                  size="small"
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={() => act(() => regenerateCharacters(id))}
                  className="btn-secondary-ghost btn-compress"
                  style={{ fontSize: 11, padding: "2px 8px" }}
                >
                  전체 재생성
                </Button>
              )}
            </Flex>

            {project.characters.length === 0 ? (
              <Empty
                description="아직 생성된 캐릭터가 없습니다"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Row gutter={[12, 12]}>
                {project.characters.map((c) => {
                  const imgJob = active.find(
                    (j) => j.type === "character_image" && j.params.characterId === c.id,
                  );
                  const isGenerating = !!imgJob;
                  return (
                    <Col key={c.id} span={24}>
                      <div
                        className={`char-profile-card ${isGenerating ? "processing-border" : ""}`}
                      >
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.name} className="char-profile-img" />
                        ) : (
                          <div
                            className="shimmer-aura"
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <Spin
                              indicator={
                                <LoadingOutlined
                                  style={{ fontSize: 24, color: "var(--primary)" }}
                                  spin
                                />
                              }
                            />
                          </div>
                        )}
                        <div className="char-profile-overlay">
                          <Text strong style={{ color: "#fff", fontSize: 14 }}>
                            {c.name}
                          </Text>
                          <Paragraph
                            ellipsis={{ rows: 2, expandable: true, symbol: "더 보기" }}
                            style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", margin: 0 }}
                          >
                            {c.description}
                          </Paragraph>
                          <Button
                            size="small"
                            block
                            icon={<PictureOutlined />}
                            loading={isGenerating}
                            onClick={() => act(() => generateCharacterImage(id, c.id))}
                            className="btn-primary-gradient btn-compress"
                            style={{ marginTop: 6, height: 28, fontSize: 11 }}
                          >
                            이미지 생성
                          </Button>
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            )}
          </div>
        </aside>

        {/* Right Content Area (68%): 실질적인 작업 공간 */}
        <section className="content-right">
          {/* 글로벌 프로세스 스텝 바 */}
          <Card className="glass-card" size="small" styles={{ body: { padding: "16px 24px" } }}>
            <Steps
              className="neon-steps"
              size="small"
              current={PHASE_STEP[project.phase] ?? 0}
              items={[
                { title: "인터뷰", icon: questionsJobRunning ? <LoadingOutlined /> : undefined },
                { title: "스토리보드" },
                { title: "회차 제작" },
              ]}
            />
          </Card>

          {/* Phase 1: 채팅식 인터뷰 플로우 */}
          {project.phase === "interview" && (
            <section className="fade-in">
              <Card
                className="glass-card"
                title={<span className="text-gradient">AI 스토리 구체화 인터뷰</span>}
              >
                <div className="qa-container">
                  {project.rounds.length > 1 && (
                    <Collapse
                      ghost
                      size="small"
                      style={{ marginBottom: 12 }}
                      items={project.rounds.slice(0, -1).map((r) => ({
                        key: r.round,
                        label: `이전 라운드 ${r.round} 답변 기록`,
                        children: r.answers.map((a) => (
                          <Paragraph
                            key={a.questionId}
                            style={{
                              marginBottom: 12,
                              paddingLeft: 12,
                              borderLeft: "2px solid var(--primary)",
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Q. {a.questionText}
                            </Text>
                            <br />
                            <Text strong style={{ fontSize: 13, color: "var(--text-primary)" }}>
                              A. {a.answer}
                            </Text>
                          </Paragraph>
                        )),
                      }))}
                    />
                  )}

                  {questionsJobRunning && currentQuestions.length === 0 && (
                    <div className="ai-question-bubble shimmer-aura" style={{ width: "100%" }}>
                      <Flex align="center" gap={8}>
                        <LoadingOutlined spin style={{ color: "var(--primary)" }} />
                        <Text type="secondary">AI가 다음 질문을 분석하고 있습니다...</Text>
                      </Flex>
                    </div>
                  )}

                  {currentQuestions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      value={answers[q.id] ?? ""}
                      onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    />
                  ))}

                  <Flex gap={12} wrap style={{ marginTop: 12 }}>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={onSubmitAnswers}
                      disabled={answeredCount === 0 || questionsJobRunning}
                      className="btn-primary-gradient btn-compress"
                      size="large"
                      style={{ borderRadius: 12 }}
                    >
                      답변 제출 → 다음 질문
                    </Button>
                    <Button
                      icon={<CheckCircleOutlined />}
                      onClick={() => act(() => buildStoryboard(id))}
                      disabled={project.rounds.length < 1}
                      className="btn-secondary-ghost btn-compress"
                      size="large"
                      style={{ borderRadius: 12 }}
                    >
                      이만하면 충분, 스토리보드 만들기
                    </Button>
                  </Flex>
                </div>
              </Card>
            </section>
          )}

          {/* Phase 2 & 3: 스토리보드 및 에피소드 타임라인 */}
          {project.storyboard && (
            <section
              className="fade-in"
              style={{ display: "flex", flexDirection: "column", gap: 24 }}
            >
              {/* 스토리보드 개요 */}
              <Card
                className="glass-card"
                title={<span className="text-gradient">스토리보드 개요</span>}
                extra={
                  <Tag color="purple" style={{ borderRadius: 6 }}>
                    {project.storyboard.genre}
                  </Tag>
                }
              >
                <Title level={4} style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>
                  {project.storyboard.title}
                </Title>
                <Paragraph
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 14,
                    lineHeight: 1.6,
                    margin: "0 0 16px",
                  }}
                >
                  {project.storyboard.logline}
                </Paragraph>
                <div style={{ display: "flex", gap: 8 }}>
                  <Tag
                    style={{
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--glass-border-outer)",
                    }}
                  >
                    화풍: {project.storyboard.artStyle}
                  </Tag>
                </div>
              </Card>

              {/* AI 피드백 퀵 액션 바 */}
              <Card
                className="glass-card"
                size="small"
                title={<span style={{ fontSize: 14, fontWeight: 600 }}>AI 에피소드 일괄 편집</span>}
              >
                <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                  원하는 수정 사항을 입력하면 AI가 전체 회차를 분석하여 일괄 수정하거나 새로운
                  회차를 추가합니다.
                </Paragraph>
                <Input.TextArea
                  rows={2}
                  className="glow-focus"
                  style={{ borderRadius: 12, marginBottom: 12 }}
                  placeholder="예: 3화를 더 코믹하게 바꾸고, 뒤에 에필로그 2화를 추가해줘"
                  value={reviseText}
                  onChange={(e) => setReviseText(e.target.value)}
                />
                <Flex gap={10} wrap>
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    disabled={!reviseText.trim()}
                    loading={storyboardJobRunning}
                    onClick={() =>
                      act(async () => {
                        await reviseEpisodes(id, reviseText.trim());
                        setReviseText("");
                      })
                    }
                    className="btn-primary-gradient btn-compress"
                  >
                    AI로 회차 수정/추가
                  </Button>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setAddingEp(true)}
                    className="btn-secondary-ghost btn-compress"
                  >
                    직접 회차 추가
                  </Button>
                </Flex>
              </Card>

              {/* 에피소드 리스트 (수직 타임라인 노드 형태) */}
              <div className="timeline-container">
                {project.storyboard.episodes.map((ep) => {
                  const detail = episodeFor(ep.index);
                  const detailJob = active.find(
                    (j) =>
                      j.type === "episode_detail" && Number(j.params.episodeIndex) === ep.index,
                  );
                  const isDetailActive = !!detail;

                  return (
                    <div
                      key={ep.index}
                      className={`timeline-item ${isDetailActive ? "active" : ""}`}
                    >
                      <div className="timeline-node" />
                      <Card
                        className="glass-card bento-interactive"
                        style={{ marginBottom: 0 }}
                        styles={{ body: { padding: 20 } }}
                      >
                        <Flex align="center" justify="space-between" wrap gap={12}>
                          <div>
                            <Tag color="indigo" style={{ marginBottom: 6 }}>
                              {ep.index}화
                            </Tag>
                            <Title level={5} style={{ margin: 0, color: "var(--text-primary)" }}>
                              {ep.title}
                            </Title>
                          </div>
                          <Flex gap={8}>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEp(ep.index);
                              }}
                              className="btn-secondary-ghost btn-compress"
                            >
                              수정
                            </Button>
                            <Button
                              size="small"
                              type={detail ? "default" : "primary"}
                              icon={detailJob ? <LoadingOutlined /> : <ThunderboltOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                act(() => detailEpisode(id, ep.index));
                              }}
                              disabled={!!detailJob}
                              className={`btn-compress ${detail ? "btn-secondary-ghost" : "btn-primary-gradient"}`}
                            >
                              {detailJob
                                ? "구체화 중..."
                                : detail
                                  ? "다시 구체화"
                                  : "이 화 구체화하기"}
                            </Button>
                          </Flex>
                        </Flex>

                        <Paragraph
                          type="secondary"
                          style={{ marginTop: 12, marginBottom: 0, fontSize: 13, lineHeight: 1.6 }}
                        >
                          {ep.synopsis}
                        </Paragraph>

                        {/* 구체화된 에피소드 상세 (시나리오 및 컷 그리드) */}
                        {detail && (
                          <div
                            className="fade-in"
                            style={{
                              marginTop: 20,
                              borderTop: "1px solid var(--glass-border-outer)",
                              paddingTop: 16,
                            }}
                          >
                            <Collapse
                              ghost
                              size="small"
                              style={{ marginBottom: 16 }}
                              items={[
                                {
                                  key: "scenario",
                                  label: (
                                    <span
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      시나리오 전문 보기 ({detail.panels.length}컷)
                                    </span>
                                  ),
                                  children: (
                                    <Paragraph
                                      style={{
                                        whiteSpace: "pre-wrap",
                                        fontSize: 13,
                                        background: "rgba(0,0,0,0.1)",
                                        padding: 12,
                                        borderRadius: 8,
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      {detail.scenario}
                                    </Paragraph>
                                  ),
                                },
                              ]}
                            />

                            {/* 컷 그리드 뷰어 */}
                            <PanelGridShowcase
                              panels={detail.panels}
                              episodeIndex={ep.index}
                              activeJobs={active}
                              onGenerateImage={(epIdx, panelIdx) =>
                                act(() => generatePanelImage(id, epIdx, panelIdx))
                              }
                              onGenerateImages={(epIdx, panelIdxs) =>
                                act(() => generatePanelImages(id, epIdx, panelIdxs))
                              }
                            />
                          </div>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>

              {project.storyboard.episodes.length === 0 && (
                <Empty description="회차가 아직 없어요" style={{ margin: "30px 0" }} />
              )}
            </section>
          )}
        </section>
      </div>

      <EpisodeEditorModal
        open={addingEp}
        title="직접 회차 추가"
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
      <EpisodeEditorModal
        open={editingEp !== null}
        title={`${editingEp}화 수정`}
        initialTitle={editingEpisode?.title ?? ""}
        initialSynopsis={editingEpisode?.synopsis ?? ""}
        onSave={(title, synopsis) =>
          act(async () => {
            if (editingEp === null) return;
            await editEpisode(id, editingEp, { title, synopsis });
            setEditingEp(null);
            refresh();
          })
        }
        onCancel={() => setEditingEp(null)}
      />
    </main>
  );
}
