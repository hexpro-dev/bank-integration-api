FROM node:20-slim AS build
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY front/package.json front/
RUN corepack enable && pnpm install --frozen-lockfile --filter @hex-pro/bank-integration-front
COPY front/ front/
RUN cd front && pnpm build
RUN pnpm deploy --filter @hex-pro/bank-integration-front --prod --legacy /app/deploy

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/front/build ./build
COPY --from=build /app/deploy/node_modules ./node_modules
COPY --from=build /app/deploy/package.json ./
EXPOSE 3000
CMD ["npx", "react-router-serve", "./build/server/index.js"]
