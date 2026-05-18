FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./

RUN npm install --ignore-scripts

COPY backend/ .

ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "src/index.js"]