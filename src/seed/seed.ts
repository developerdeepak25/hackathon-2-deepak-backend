/**
 * Manual seed entry point. The API also runs this logic on startup.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { seedDatabase } from './seed-database.js';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await seedDatabase(app);
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
