const os = require('os');
const dockerEngine = require('../orchestrator/dockerEngine');

async function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePct = Math.round((usedMem / totalMem) * 100);

  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown';
  const cpuCores = cpus.length;

  const isDockerActive = await dockerEngine.checkDocker();

  return {
    os: {
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: Math.round(os.uptime())
    },
    cpu: {
      model: cpuModel,
      cores: cpuCores
    },
    memory: {
      total: Math.round(totalMem / (1024 * 1024)),
      free: Math.round(freeMem / (1024 * 1024)),
      used: Math.round(usedMem / (1024 * 1024)),
      percent: memUsagePct
    },
    docker: {
      available: isDockerActive,
      mode: isDockerActive ? 'Docker Containerization' : 'Isolated Process Sandbox'
    }
  };
}

module.exports = { getSystemInfo };
