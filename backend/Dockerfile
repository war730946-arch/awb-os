FROM node:20-alpine

ARG CACHEBUST=1

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN echo "Build: $(date -u +%Y-%m-%dT%H:%M:%SZ) cachebust=$CACHEBUST" > /app/build-info.txt

ENV NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "src/index.js"]
