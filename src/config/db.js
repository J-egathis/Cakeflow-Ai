const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;
  if (primaryUri) {
    try {
      console.log('Attempting connection to MongoDB Atlas...');
      const conn = await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 4000
      });
      console.log(`MongoDB Connected (Atlas): ${conn.connection.host}`);
      return;
    } catch (error) {
      console.warn(`Atlas connection failed (${error.message}). Falling back to In-Memory Database...`);
    }
  }

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create({
      binary: {
        version: '6.0.14'
      }
    });
    const uri = mongod.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected (In-Memory Fallback): ${conn.connection.host}`);
  } catch (memErr) {
    console.warn('In-memory MongoDB startup failed, attempting local MongoDB connection...');
    try {
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/cakeflow');
      console.log(`MongoDB Connected (Local): ${conn.connection.host}`);
    } catch (localErr) {
      console.error(`Database connection error: ${localErr.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
