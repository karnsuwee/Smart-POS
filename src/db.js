import mongoose from 'mongoose';
import { config } from './config.js';

let dbReady = false;

export function isDbReady() {
  return dbReady;
}

export async function connectDb() {
  if (!config.mongoUri) return false;

  try {
    await mongoose.connect(config.mongoUri);
    dbReady = true;
    return true;
  } catch (error) {
    console.error('MongoDB connection failed. Starting memory demo mode.', error.message);
    dbReady = false;
    return false;
  }
}
