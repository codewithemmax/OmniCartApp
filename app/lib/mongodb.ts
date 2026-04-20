import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) throw new Error("Please define MONGODB_URI in .env.local");

const globalWithMongoose = global as typeof global & {
  _mongooseConn: typeof mongoose | null;
  _mongoosePromise: Promise<typeof mongoose> | null;
};

if (!globalWithMongoose._mongooseConn) globalWithMongoose._mongooseConn = null;
if (!globalWithMongoose._mongoosePromise) globalWithMongoose._mongoosePromise = null;

export async function connectDB() {
  if (globalWithMongoose._mongooseConn) return globalWithMongoose._mongooseConn;

  if (!globalWithMongoose._mongoosePromise) {
    globalWithMongoose._mongoosePromise = mongoose
      .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .catch((err) => {
        // Clear the cached promise so the next request retries
        globalWithMongoose._mongoosePromise = null;
        throw err;
      });
  }

  globalWithMongoose._mongooseConn = await globalWithMongoose._mongoosePromise;
  return globalWithMongoose._mongooseConn;
}
