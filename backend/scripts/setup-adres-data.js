const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/main/';
const FILES = [
  'sehirler.json',
  'ilceler.json',
  'mahalleler-1.json',
  'mahalleler-2.json',
  'mahalleler-3.json',
  'mahalleler-4.json'
];
const OUTPUT_DIR = path.join(__dirname, '..', 'data');

function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + filename;
    const destPath = path.join(OUTPUT_DIR, filename);
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        https.get(redirectUrl, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log('Downloaded:', filename);
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Downloaded:', filename);
          resolve();
        });
      } else {
        reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  for (const file of FILES) {
    try {
      await downloadFile(file);
    } catch (err) {
      console.error('Error downloading', file, err.message);
      process.exit(1);
    }
  }
  console.log('All files downloaded successfully.');
}

main();
