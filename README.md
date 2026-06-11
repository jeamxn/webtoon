# webtoon

예시 이미지와 주제만 입력하면, AI가 인터뷰(질문-답변 루프)로 스토리를 구체화해서
스토리보드를 짜고, 화별 콘티와 웹툰 컷 이미지를 생성해주는 프로그램.

## 스택

- **모노레포**: pnpm workspace + Turborepo, Node 24
- **프론트**: React Router v7 (SPA mode) — `apps/web`
- **백엔드**: NestJS — `apps/api`
- **공유 타입**: `packages/shared`
- **린트/포맷**: Biome · **타입체크**: tsc
- **LLM**: OpenAI GPT-5.5 (질문 생성·스토리보드·화 구체화), gpt-image-2 (컷 이미지 생성)

## 시작하기

```bash
cp .env.example .env   # OPENAI_API_KEY 채우기
pnpm install
pnpm dev               # web :3000, api :4000
```

- `pnpm build` — 전체 빌드
- `pnpm typecheck` — 타입체크
- `pnpm lint` / `pnpm lint:fix` — Biome

### Docker

```bash
docker compose up --build
# web: http://localhost:3000, api: http://localhost:4000
```

## 사용 흐름

1. 홈에서 **주제 + 화풍 예시 이미지** 업로드 → 프로젝트 생성
2. AI가 질문 3~5개 생성 → 선택지 클릭 또는 자유 답변 → 제출하면 다음 라운드 질문
3. 충분히 답했으면 **스토리보드 만들기** → 제목/로그라인/등장인물/화별 줄거리 생성
4. 각 화 **구체화하기** → 시나리오 + 컷(패널) 단위 콘티 생성
5. 컷별 **그리기** → gpt-image-2가 예시 이미지를 화풍 레퍼런스로 컷 이미지 생성

## API

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/projects` | 프로젝트 생성 (multipart: `topic`, `images[]`) + 1라운드 질문 |
| GET | `/api/projects` / `/api/projects/:id` | 목록 / 단건 조회 |
| POST | `/api/projects/:id/answers` | 답변 제출 → 다음 라운드 질문 |
| POST | `/api/projects/:id/storyboard` | 스토리보드 생성 |
| POST | `/api/projects/:id/episodes/:index` | 해당 화 구체화 (시나리오+패널) |
| POST | `/api/projects/:id/episodes/:index/panels/:panel/image` | 패널 이미지 생성 |

데이터는 `apps/api/data/`에 JSON/파일로 저장됨 (DB 없음).
