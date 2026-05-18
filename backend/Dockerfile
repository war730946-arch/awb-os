FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssh

COPY package*.json ./

RUN npm install

COPY . .

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
