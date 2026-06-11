ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginx:alpine
FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @webtoon/shared build && pnpm --filter @webtoon/web build

ARG NGINX_IMAGE=nginx:alpine
FROM ${NGINX_IMAGE}
COPY --from=build /repo/apps/web/build/client /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
