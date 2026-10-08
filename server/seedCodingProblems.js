import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';
import logger from './config/logger.js';
import CodingProblem from './models/CodingProblem.js';
import CodingSubmission from './models/CodingSubmission.js';
import DebuggingSubmission from './models/DebuggingSubmission.js';
import { seedCodingProblems } from './services/codingProblemSeeder.js';

const RESET = process.argv.includes('--reset');

const seed = async () => {
  await connectDB();
  await connectRedis();

  if (RESET) {
    const dropped = await CodingProblem.deleteMany({});
    const subs = await CodingSubmission.deleteMany({});
    logger.warn(
      `♻️  Reset — removed ${dropped.deletedCount} problems and ${subs.deletedCount} submissions (history discarded)`
    );
  }

  await seedCodingProblems({ resetStats: RESET });
  const [codingTiming, debuggingTiming] = await Promise.all([
    CodingSubmission.collection.updateMany(
      { elapsedSeconds: { $exists: true } },
      { $unset: { elapsedSeconds: '' } }
    ),
    DebuggingSubmission.collection.updateMany(
      { elapsedSeconds: { $exists: true } },
      { $unset: { elapsedSeconds: '' } }
    ),
  ]);
  logger.info(
    `Removed question timing from ${codingTiming.modifiedCount} coding and ${debuggingTiming.modifiedCount} debugging submissions`
  );

  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  process.exit(0);
};

seed().catch((err) => {
  logger.error(`❌ Coding seed failed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
