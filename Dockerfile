FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.29.1 --activate

COPY frontend/package.json frontend/pnpm-lock.yaml* frontend/.npmrc* ./

RUN pnpm install --frozen-lockfile

COPY frontend/ .

ARG VITE_API_URL=/api
ARG VITE_APP_TITLE="Canary Token Generator"
ARG VITE_TURNSTILE_SITE_KEY=""

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_APP_TITLE=${VITE_APP_TITLE} \
    VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}

RUN pnpm build

FROM nginx:1.27-alpine AS production

RUN rm -rf /usr/share/nginx/html/* && \
    rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

COPY --chown=nginx:nginx infra/nginx/nginx.prod.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx infra/nginx/prod.nginx /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
