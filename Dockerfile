FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/frontend/dist ./frontend/dist
EXPOSE 2000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget -qO- http://127.0.0.1:2000/health || exit 1
CMD ["node","dist/backend/server.js"]
