require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const scripts = [
  'seed-address-hierarchy.js',
  'seed-address-locales.js',
  'seed-document-types.js',
];

async function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    console.log(`\n🚀 Running ${scriptName}...\n`);

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${scriptName} completed successfully\n`);
        resolve();
      } else {
        console.error(`\n❌ ${scriptName} failed with exit code ${code}\n`);
        reject(new Error(`${scriptName} failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`\n❌ Error running ${scriptName}:`, error.message);
      reject(error);
    });
  });
}

async function seedAll() {
  console.log('🌱 Starting seed process...\n');
  console.log('='.repeat(50));

  try {
    for (const script of scripts) {
      await runScript(script);
    }

    console.log('='.repeat(50));
    console.log('\n🎉 All seed scripts completed successfully!\n');
  } catch (error) {
    console.error('\n💥 Seed process failed:', error.message);
    process.exitCode = 1;
    process.exit(1);
  }
}

seedAll();
