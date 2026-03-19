/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { spawn } from 'child_process';
import 'dotenv/config';
import path from 'path';

declare const __dirname: string;

const scripts = [
  'seed-address-hierarchy.ts',
  'seed-address-locales.ts',
  'seed-document-types.ts',
  'seed-pickup-stations.ts',
  'seed-transition-statuses.ts',
  'seed-admin-user.ts',
  'seed-templates.ts',
];

async function runScript(scriptName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    console.log(`\n🚀 Running ${scriptName}...\n`);

    const child = spawn('npx', ['ts-node', scriptPath], {
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

async function seedAll(): Promise<void> {
  console.log('🌱 Starting seed process...\n');
  console.log('='.repeat(50));

  try {
    for (const script of scripts) {
      await runScript(script);
    }

    console.log('='.repeat(50));
    console.log('\n🎉 All seed scripts completed successfully!\n');
  } catch (error: any) {
    console.error('\n💥 Seed process failed:', error.message);
    process.exitCode = 1;
    process.exit(1);
  }
}

seedAll();
