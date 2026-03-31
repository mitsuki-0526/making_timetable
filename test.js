const { execSync } = require('child_process');
const fs = require('fs');
try {
  execSync('npx vite build', { stdio: 'pipe' });
} catch (e) {
  fs.writeFileSync('error.txt', e.stderr, { encoding: 'utf-8' });
  console.log('Error logged to error.txt');
}
