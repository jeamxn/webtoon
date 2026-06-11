import type { Project } from "@webtoon/shared";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { createProject, listProjects } from "../api";

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [files]);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { project } = await createProject(topic, files);
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>Webtoon Studio</h1>
      <p className="muted">
        예시 이미지와 주제를 입력하면, AI가 질문을 통해 스토리보드를 짜고 화별 웹툰을 그려줍니다.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>새 웹툰 시작하기</h2>
        <label>
          <div className="muted">주제</div>
          <input
            type="text"
            value={topic}
            placeholder="예: 출근길에 갑자기 고양이가 말을 걸어온다"
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
        <div style={{ marginTop: 12 }}>
          <div className="muted">화풍 예시 이미지 (최대 8장)</div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}
          />
          <div className="thumbs">
            {previews.map((src) => (
              <img key={src} src={src} alt="예시" />
            ))}
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" onClick={onSubmit} disabled={loading || !topic.trim()}>
            {loading ? "질문 생성 중..." : "시작하기"}
          </button>
          {loading && <span className="spinner" />}
        </div>
        {error && <p style={{ color: "#ff7a7a" }}>{error}</p>}
      </div>

      {projects.length > 0 && (
        <>
          <h2>진행 중인 프로젝트</h2>
          {projects.map((p) => (
            <div key={p.id} className="card">
              <div className="row">
                <Link to={`/projects/${p.id}`}>
                  <strong>{p.storyboard?.title ?? p.topic}</strong>
                </Link>
                <span className="badge">{p.phase}</span>
              </div>
              <div className="muted">{new Date(p.createdAt).toLocaleString("ko-KR")}</div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
