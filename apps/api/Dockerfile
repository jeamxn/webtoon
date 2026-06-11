FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @webtoon/shared build && pnpm --filter @webtoon/api build
RUN pnpm --filter @webtoon/api deploy --legacy --prod /out

FROM node:24-alpine
WORKDIR /app
COPY --from=build /out .
COPY --from=build /repo/apps/api/dist ./dist
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/main.js"]
