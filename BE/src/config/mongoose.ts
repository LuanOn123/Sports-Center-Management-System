import mongoose from 'mongoose';
import { configureDns } from './dns.js';

export const connectMongo = async (): Promise<void> => {
  try {
    configureDns();
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sports_center';
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed. Check DNS_SERVERS, network access and Atlas IP permissions.');
    throw error;
  }
};
