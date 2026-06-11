import {
  AppstoreOutlined,
  BulbOutlined,
  FireOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  RightOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import type { Project } from "@webtoon/shared";
import type { UploadFile } from "antd";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Image,
  Input,
  Row,
  Tag,
  Typography,
  Upload,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { createProject, listProjects } from "../api";

const { Text, Title } = Typography;

const PHASE_LABEL: Record<string, { label: string; color: string }> = {
  interview: { label: "인터뷰", color: "blue" },
  storyboard: { label: "스토리보드", color: "purple" },
  episodes: { label: "회차 작업", color: "green" },
};

const PRESETS = [
  {
    title: "로맨스 판타지",
    desc: "빙의했더니 악역 영애가 되었다",
    icon: "✨",
  },
  {
    title: "현대 활극",
    desc: "헌터 아카데미의 먼치킨 신입생",
    icon: "⚔️",
  },
  {
    title: "학원 로맨스",
    desc: "짝사랑 상대가 나에게만 속삭인다",
    icon: "🏫",
  },
  {
    title: "미스터리 스릴러",
    desc: "지하철 마지막 칸에 남겨진 사람들",
    icon: "👁️",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [topic, setTopic] = useState("");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects().then(setProjects).catch(console.error);
  }, []);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const files = fileList
        .map((f) => f.originFileObj)
        .filter((f): f is NonNullable<typeof f> => !!f);
      const { project } = await createProject(topic, files);
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  return (
    <main className="page">
      {/* Chroma Glass Canvas 전용 글로벌 스타일 주입 */}
      <style>{`
        :root {
          --bg-base: #f8fafc;
          --bg-glow-1: rgba(99, 102, 241, 0.05);
          --bg-glow-2: rgba(6, 182, 212, 0.04);
          
          --glass-bg: rgba(255, 255, 255, 0.75);
          --glass-border-outer: rgba(15, 23, 42, 0.06);
          --glass-border-inner: rgba(255, 255, 255, 0.6);
          
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --text-muted: #94a3b8;
          
          --primary: #6366f1;
          --secondary: #06b6d4;
          --accent-gradient: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
          
          --shadow-depth: 0 20px 40px -15px rgba(15, 23, 42, 0.08);
          --spring-transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }

        html[data-theme="dark"] {
          --bg-base: #08090d;
          --bg-glow-1: rgba(129, 140, 248, 0.12);
          --bg-glow-2: rgba(56, 189, 248, 0.08);
          
          --glass-bg: rgba(17, 19, 28, 0.65);
          --glass-border-outer: rgba(255, 255, 255, 0.07);
          --glass-border-inner: rgba(255, 255, 255, 0.02);
          
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --text-muted: #475569;
          
          --primary: #818cf8;
          --secondary: #38bdf8;
          --accent-gradient: linear-gradient(135deg, #818cf8 0%, #38bdf8 100%);
          
          --shadow-depth: 0 24px 50px -12px rgba(0, 0, 0, 0.5);
        }

        body {
          background-color: var(--bg-base) !important;
          background-image: 
            radial-gradient(1000px 600px at 10% -10%, var(--bg-glow-1), transparent 50%),
            radial-gradient(800px 500px at 90% 15%, var(--bg-glow-2), transparent 45%) !important;
          background-attachment: fixed !important;
          color: var(--text-primary) !important;
          transition: background-color 0.3s ease !important;
        }

        /* Glassmorphism Card */
        .glass-card {
          background: var(--glass-bg) !important;
          backdrop-filter: blur(20px) saturate(1.4) !important;
          -webkit-backdrop-filter: blur(20px) saturate(1.4) !important;
          border: 1px solid var(--glass-border-outer) !important;
          box-shadow: var(--shadow-depth), inset 0 1px 1px var(--glass-border-inner) !important;
          border-radius: 16px !important;
          transition: var(--spring-transition) !important;
        }

        /* Bento Spring Hover Effect */
        .bento-interactive {
          cursor: pointer;
        }
        .glass-card.bento-interactive {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s, box-shadow 0.3s !important;
        }
        .glass-card.bento-interactive:hover {
          transform: translateY(-4px) scale(1.015) !important;
          border-color: rgba(129, 140, 248, 0.3) !important;
          box-shadow: 
            0 30px 60px -15px rgba(0, 0, 0, 0.3),
            0 0 20px 0px rgba(129, 140, 248, 0.1) !important;
        }

        /* Gradient Text */
        .text-gradient {
          background: var(--accent-gradient) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          font-weight: 850 !important;
        }

        /* Hero Title */
        .hero-title {
          font-size: clamp(2.2rem, 5vw, 3.8rem) !important;
          font-weight: 900 !important;
          letter-spacing: -0.04em !important;
          line-height: 1.15 !important;
          margin-bottom: 16px !important;
        }

        /* Project Card Cover Zoom */
        .project-card-cover-container {
          overflow: hidden;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          position: relative;
        }
        .project-card-cover-img {
          transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1) !important;
        }
        .bento-interactive:hover .project-card-cover-img {
          transform: scale(1.08) !important;
        }

        /* Active Button Compress */
        .btn-compress {
          transition: transform 0.1s ease !important;
        }
        .btn-compress:active {
          transform: scale(0.96) !important;
        }

        /* Primary CTA Button Hover */
        .primary-cta-btn {
          background: var(--accent-gradient) !important;
          border: none !important;
          color: #ffffff !important;
          transition: var(--spring-transition) !important;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3) !important;
        }
        .primary-cta-btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5) !important;
          opacity: 0.95;
        }
        .primary-cta-btn:active {
          transform: scale(0.96) !important;
        }

        /* Custom Input Focus Glow */
        .ant-input {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid var(--glass-border-outer) !important;
          border-radius: 12px !important;
          color: var(--text-primary) !important;
          transition: var(--spring-transition) !important;
        }
        html[data-theme="light"] .ant-input {
          background: rgba(0, 0, 0, 0.02) !important;
        }
        .ant-input:focus, .ant-input-focused {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.2), 0 0 20px rgba(129, 140, 248, 0.15) !important;
        }

        /* Upload Dragger Style */
        .ant-upload-drag {
          background: rgba(129, 140, 248, 0.02) !important;
          border: 1px dashed var(--glass-border-outer) !important;
          border-radius: 12px !important;
          transition: var(--spring-transition) !important;
        }
        .ant-upload-drag:hover {
          border-color: var(--primary) !important;
          background: rgba(129, 140, 248, 0.04) !important;
        }

        /* Staggered Fade-In */
        .fade-in-stagger {
          animation: fadeInStagger 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes fadeInStagger {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Hero Section */}
      <section className="hero fade-in" style={{ padding: "60px 0 40px" }}>
        <h1 className="hero-title">
          <span className="text-gradient">당신의 이야기를</span> 웹툰으로
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          예시 이미지와 주제만 입력하면, AI가 질문을 통해 스토리보드를 짜고 캐릭터를 만들고 컷
          하나하나를 그려냅니다.
        </p>
      </section>

      {/* Bento Grid Layout */}
      <Row gutter={[24, 24]}>
        {/* Bento Main Card (Col-span 8) */}
        <Col xs={24} lg={16}>
          <Card
            className="glass-card"
            title={
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                <RocketOutlined style={{ marginRight: 8, color: "var(--primary)" }} />새 웹툰
                시작하기
              </span>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <Text type="secondary" style={{ fontWeight: 600, fontSize: 13 }}>
                  주제
                </Text>
                <Input
                  size="large"
                  style={{ marginTop: 8 }}
                  value={topic}
                  placeholder="예: 출근길에 갑자기 고양이가 말을 걸어온다"
                  onChange={(e) => setTopic(e.target.value)}
                  onPressEnter={() => topic.trim() && !loading && onSubmit()}
                />
              </div>

              <div>
                <Text type="secondary" style={{ fontWeight: 600, fontSize: 13 }}>
                  화풍 예시 이미지 (최대 8장)
                </Text>
                <Upload.Dragger
                  style={{ marginTop: 8 }}
                  accept="image/*"
                  multiple
                  listType="picture-card"
                  fileList={fileList}
                  beforeUpload={() => false}
                  onChange={({ fileList: fl }) => setFileList(fl.slice(0, 8))}
                >
                  <p className="ant-upload-drag-icon" style={{ color: "var(--primary)" }}>
                    <InboxOutlined />
                  </p>
                  <p
                    className="ant-upload-text"
                    style={{ color: "var(--text-primary)", fontWeight: 600 }}
                  >
                    클릭하거나 이미지를 끌어다 놓으세요
                  </p>
                  <p
                    className="ant-upload-hint"
                    style={{ color: "var(--text-muted)", fontSize: 12 }}
                  >
                    원하는 그림체의 웹툰 캡처/일러스트 예시
                  </p>
                </Upload.Dragger>
              </div>

              {error && (
                <Alert type="error" showIcon message={error} style={{ borderRadius: 12 }} />
              )}

              <Button
                type="primary"
                size="large"
                className="primary-cta-btn btn-compress"
                icon={<RocketOutlined />}
                loading={loading}
                disabled={!topic.trim()}
                onClick={onSubmit}
                style={{ height: 50, borderRadius: 12, fontSize: 16, fontWeight: 700 }}
              >
                {loading ? "질문 생성 중..." : "시작하기"}
              </Button>
            </div>
          </Card>
        </Col>

        {/* Bento Widgets (Col-span 4) */}
        <Col xs={24} lg={8}>
          <Flex vertical gap={24} style={{ height: "100%" }}>
            {/* Bento Widget A: AI Credit & Guide */}
            <Card
              className="glass-card"
              title={
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>
                  <InfoCircleOutlined style={{ marginRight: 8, color: "var(--secondary)" }} />
                  AI 크레딧 & 가이드
                </span>
              }
            >
              <Flex vertical gap={16}>
                {/* Credit Status */}
                <div
                  style={{
                    padding: "16px",
                    borderRadius: 12,
                    background: "rgba(6, 182, 212, 0.03)",
                    border: "1px solid var(--glass-border-outer)",
                  }}
                >
                  <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      <FireOutlined style={{ marginRight: 6, color: "var(--secondary)" }} />
                      AI 연산 크레딧
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--secondary)" }}>
                      850 / 1000 CC
                    </span>
                  </Flex>
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      background: "rgba(129, 140, 248, 0.1)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: "85%",
                        height: "100%",
                        background: "var(--accent-gradient)",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 8,
                      textAlign: "right",
                    }}
                  >
                    매일 자정 충전됨
                  </div>
                </div>

                {/* Quick Tips */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--primary)", fontSize: 14 }}>💡</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      구체적인 상황(표정, 구도, 날씨)을 적을수록 고품질의 화풍이 생성됩니다.
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--primary)", fontSize: 14 }}>🎨</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      원하는 그림체의 예시 이미지를 다양하게 등록하면 AI 학습 정밀도가 향상됩니다.
                    </span>
                  </div>
                </div>
              </Flex>
            </Card>

            {/* Bento Widget B: Style Presets */}
            <Card
              className="glass-card"
              title={
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>
                  <BulbOutlined style={{ marginRight: 8, color: "#FBBF24" }} />
                  추천 장르 & 화풍 프리셋
                </span>
              }
            >
              <Flex vertical gap={10}>
                {PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.title}
                    onClick={() => setTopic(preset.desc)}
                    className="bento-interactive"
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      background: "rgba(129, 140, 248, 0.03)",
                      border: "1px solid var(--glass-border-outer)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "var(--spring-transition)",
                      width: "100%",
                      cursor: "pointer",
                    }}
                  >
                    <Flex align="center" gap={12}>
                      <span style={{ fontSize: 18 }}>{preset.icon}</span>
                      <div>
                        <div
                          style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}
                        >
                          {preset.title}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                          {preset.desc}
                        </div>
                      </div>
                    </Flex>
                    <RightOutlined style={{ fontSize: 12, color: "var(--text-muted)" }} />
                  </button>
                ))}
              </Flex>
            </Card>
          </Flex>
        </Col>
      </Row>

      {/* Projects Grid Section */}
      <div
        style={{
          marginTop: 48,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Title
          level={4}
          style={{
            margin: 0,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          <AppstoreOutlined style={{ marginRight: 8, color: "var(--primary)" }} />
          진행 중인 프로젝트
        </Title>
        <Tag color="blue" style={{ borderRadius: 12, padding: "2px 10px", fontWeight: 600 }}>
          총 {projects.length}개
        </Tag>
      </div>

      {projects.length === 0 ? (
        <Empty description="아직 프로젝트가 없어요" style={{ padding: "40px 0" }} />
      ) : (
        <Row gutter={[24, 24]}>
          {projects.map((p, idx) => {
            const phase = PHASE_LABEL[p.phase] ?? { label: p.phase, color: "default" };
            const cover = p.exampleImages[0]?.url;
            return (
              <Col
                key={p.id}
                xs={24}
                sm={12}
                lg={8}
                className="fade-in-stagger"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <Card
                  hoverable
                  className="glass-card bento-interactive"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  style={{ height: "100%", display: "flex", flexDirection: "column" }}
                  styles={{
                    body: {
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: 20,
                    },
                  }}
                  cover={
                    cover ? (
                      <div className="project-card-cover-container" style={{ height: 160 }}>
                        <Image
                          src={cover}
                          alt="예시"
                          preview={false}
                          className="project-card-cover-img"
                          style={{ objectFit: "cover", width: "100%", height: "100%" }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 160,
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(129, 140, 248, 0.03)",
                          borderTopLeftRadius: 16,
                          borderTopRightRadius: 16,
                        }}
                      >
                        <PictureOutlined
                          style={{ fontSize: 32, color: "var(--text-muted)", opacity: 0.5 }}
                        />
                      </div>
                    )
                  }
                >
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}
                  >
                    <Title
                      level={5}
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        lineHeight: 1.4,
                      }}
                    >
                      {p.storyboard?.title ?? p.topic}
                    </Title>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginTop: "auto",
                      }}
                    >
                      <Tag
                        color={phase.color}
                        style={{ width: "fit-content", borderRadius: 6, fontWeight: 600 }}
                      >
                        {phase.label}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(p.createdAt).toLocaleString("ko-KR")}
                      </Text>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </main>
  );
}
