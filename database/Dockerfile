FROM node:20-slim
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY database/ database/
RUN corepack enable && pnpm install --frozen-lockfile --filter @hex-pro/bank-integration-database
RUN cd database && pnpm build:lib
WORKDIR /app/database
CMD ["pnpm", "db:migrate"]
