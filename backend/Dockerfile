FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=5050
USER node
EXPOSE 5050

CMD ["node", "src/server.js"]
