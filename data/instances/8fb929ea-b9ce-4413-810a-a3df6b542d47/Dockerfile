# Generated Dockerfile for Minecraft (Java) #1
FROM node:20-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN if [ -f package.json ]; then npm install --production; fi

# Copy application files
COPY . .

ENV NODE_ENV=production
CMD ["node", "start.bat"]
