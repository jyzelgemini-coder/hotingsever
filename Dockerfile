FROM node:20-alpine

# Install Python & build tools if bots run inside the container
RUN apk add --no-cache python3 py3-pip git bash

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Expose Web Panel & WebSocket port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
