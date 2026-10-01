import mongoose from 'mongoose';
import logger from './logger.js';
import dns from 'dns';

const connectDB = async () => {
  try {
    dns.setServers(['1.1.1.1']);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 10,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () =>
      logger.warn('MongoDB disconnected — attempting to reconnect...')
    );
    mongoose.connection.on('reconnected', () =>
      logger.info('MongoDB reconnected ✅')
    );
    mongoose.connection.on('error', (err) =>
      logger.error(`MongoDB connection error: ${err.message}`)
    );
  } catch (err) {
    logger.error(`❌ MongoDB Error: ${err.message}`);
    process.exit(1);
  }
};

export default connectDB;
