FROM node:22-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 5050

ENTRYPOINT ["./docker-entrypoint.sh"]
