# --- Стадия сборки: tsc → dist/ ---
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Стадия запуска: только prod-зависимости и dist/ ---
FROM node:22-bookworm-slim AS prod

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

# swagger.ts при старте сканирует dist/pages/**/*.{js,ts} — копируем весь dist
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/app/index.js"]
