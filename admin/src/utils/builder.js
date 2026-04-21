const { exec } = require('child_process');
const path = require('path');

const BLOG_PATH = process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev';
const BUILD_TIMEOUT = 5 * 60 * 1000; // 5 minutos

function runBuild() {
  return new Promise((resolve, reject) => {
    const proc = exec(
      'npm run build',
      { cwd: BLOG_PATH, timeout: BUILD_TIMEOUT },
      (error, stdout, stderr) => {
        if (error) {
          return reject({ message: error.message, output: stderr || stdout });
        }
        resolve({ success: true, output: stdout });
      }
    );

    // Garantiza que el proceso se mata si supera el timeout
    const timer = setTimeout(() => {
      proc.kill();
      reject({ message: 'Build cancelado: timeout de 5 minutos superado', output: '' });
    }, BUILD_TIMEOUT);

    proc.on('close', () => clearTimeout(timer));
  });
}

module.exports = { runBuild };
