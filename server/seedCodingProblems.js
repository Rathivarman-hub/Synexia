import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import logger from './config/logger.js';
import CodingProblem from './models/CodingProblem.js';
import { seedCodingProblems } from './services/codingProblemSeeder.js';

const RESET = process.argv.includes('--reset');

const seed = async () => {
  await connectDB();

  if (RESET) {
    const { default: CodingSubmission } = await import('./models/CodingSubmission.js');
    const dropped = await CodingProblem.deleteMany({});
    const subs = await CodingSubmission.deleteMany({});
    logger.warn(
      `♻️  Reset — removed ${dropped.deletedCount} problems and ${subs.deletedCount} submissions (history discarded)`
    );
  }

  await seedCodingProblems({ resetStats: RESET });

  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  process.exit(0);
};

seed().catch((err) => {
  logger.error(`❌ Coding seed failed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
