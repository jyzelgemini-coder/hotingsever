const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class DockerEngine {
  constructor() {
    this.isAvailable = false;
    this.checkDocker();
  }

  checkDocker() {
    return new Promise((resolve) => {
      exec('docker info', (err) => {
        this.isAvailable = !err;
        resolve(this.isAvailable);
      });
    });
  }

  generateDockerfile(server) {
    const { runtime, entryFile = 'bot.js', envVars = {} } = server;

    if (runtime === 'python') {
      return `# Generated Dockerfile for ${server.name || 'Python Bot'}
FROM python:3.11-slim

# Prevent Python from writing .pyc and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies if present
COPY requirements*.txt ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Copy application code
COPY . .

# Run bot
CMD ["python", "${entryFile || 'bot.py'}"]
`;
    }

    if (runtime === 'node') {
      const portExpose = envVars.PORT ? `EXPOSE ${envVars.PORT}\n` : '';
      return `# Generated Dockerfile for ${server.name || 'Node.js Bot/App'}
FROM node:20-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN if [ -f package.json ]; then npm install --production; fi

# Copy application files
COPY . .

${portExpose}ENV NODE_ENV=production
CMD ["node", "${entryFile || 'bot.js'}"]
`;
    }

    // Generic fallback
    return `# Generic Container
FROM alpine:latest
WORKDIR /app
COPY . .
CMD ["sh", "${entryFile || 'start.sh'}"]
`;
  }

  generateDockerCompose(server) {
    const safeName = (server.name || 'bot-server')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    
    const envLines = Object.entries(server.envVars || {})
      .map(([k, v]) => `      - ${k}=${v}`)
      .join('\n');

    const portLines = server.envVars && server.envVars.PORT
      ? `    ports:\n      - "${server.envVars.PORT}:${server.envVars.PORT}"\n`
      : '';

    return `version: '3.8'

services:
  ${safeName}:
    build: .
    container_name: ${safeName}-${server.id.slice(0, 8)}
    restart: unless-stopped
${portLines}    environment:
${envLines || '      - NODE_ENV=production'}
    deploy:
      resources:
        limits:
          memory: ${server.plan?.memory || '512M'}
          cpus: '${server.plan?.cpu || '0.5'}'
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
`;
  }

  async writeDockerConfig(server, instanceDir) {
    try {
      const dockerfileContent = this.generateDockerfile(server);
      const composeContent = this.generateDockerCompose(server);

      fs.writeFileSync(path.join(instanceDir, 'Dockerfile'), dockerfileContent, 'utf-8');
      fs.writeFileSync(path.join(instanceDir, 'docker-compose.yml'), composeContent, 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to write Docker configs:', e);
      return false;
    }
  }

  async runDocker(server, instanceDir) {
    const isAvail = await this.checkDocker();
    if (!isAvail) {
      return { success: false, error: 'Docker daemon is not running or Docker CLI is not installed.' };
    }

    await this.writeDockerConfig(server, instanceDir);
    const containerName = `bot-${server.id}`;

    return new Promise((resolve) => {
      exec(`docker compose up -d --build`, { cwd: instanceDir }, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  }

  async stopDocker(instanceDir) {
    return new Promise((resolve) => {
      exec(`docker compose down`, { cwd: instanceDir }, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  }
}

const dockerEngine = new DockerEngine();
module.exports = dockerEngine;
