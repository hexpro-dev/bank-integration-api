FROM node:20-slim

RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
    libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
    xdg-utils --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV REBROWSER_PATCHES_RUNTIME_FIX_MODE=alwaysIsolated

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY observer/package.json observer/
RUN corepack enable && pnpm install --frozen-lockfile --filter @hex-pro/bank-integration-observer
COPY observer/ observer/
RUN cd observer && pnpm build

VOLUME ["/app/browser-profiles"]
WORKDIR /app/observer
CMD ["node", "dist/index.js"]
