const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (mongoURI) {
    try {
      console.log(`Connecting to MongoDB Atlas...`);
      const conn = await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000
      });
      console.log(`✅ MongoDB Atlas Connected Successfully: ${conn.connection.host}`);
      return;
    } catch (err) {
      console.error(`MongoDB Atlas Primary Connection Attempt failed: ${err.message}`);
    }
  }

  // Fallback for local development
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create({
      binary: { version: '6.0.14' }
    });
    const uri = mongod.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected (In-Memory Fallback): ${conn.connection.host}`);
  } catch (memErr) {
    try {
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/cakeflow');
      console.log(`MongoDB Connected (Local): ${conn.connection.host}`);
    } catch (localErr) {
      console.error(`Database connection error: ${localErr.message}`);
    }
  }
};

module.exports = connectDB;
