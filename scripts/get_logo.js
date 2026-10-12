const https = require('https');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Saved: ${dest}`);
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    await download('https://image.deencommerce.com/wp-content/uploads/2026/05/Deen_Traditional_Logo.png', path.join(publicDir, 'deen-logo.png'));
    await download('https://image.deencommerce.com/wp-content/uploads/2026/05/Deen_Traditional_Logo-cropped.svg', path.join(publicDir, 'deen-logo.svg'));
    await download('https://image.deencommerce.com/wp-content/uploads/2026/05/Deen_Traditional_Logo-150x137.png', path.join(publicDir, 'deen-icon.png'));
    console.log('All downloads succeeded!');
  } catch (err) {
    console.error('Download error:', err);
  }
}

main();
