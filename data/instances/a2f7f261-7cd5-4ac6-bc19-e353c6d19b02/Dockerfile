# Generated Dockerfile for Demo Telegram Bot
FROM node:20-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN if [ -f package.json ]; then npm install --production; fi

# Copy application files
COPY . .

ENV NODE_ENV=production
CMD ["node", "bot.js"]
