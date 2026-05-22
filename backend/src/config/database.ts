import mongoose from 'mongoose';

// ──────────────────────────────────────────────
// MongoDB connection with retry logic & event logging
// ──────────────────────────────────────────────
export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-assistant';
  const maxRetries = 5;
  let attempt = 0;

  // ── Connection event listeners ──
  mongoose.connection.on('connected', () => {
    console.log(`✅ MongoDB connected: ${uri}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
  });

  // ── Graceful shutdown support ──
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed on app termination');
    process.exit(0);
  });

  while (attempt < maxRetries) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
        retryReads: true,
      });

      // Ensure indexes are built
      await mongoose.connection.syncIndexes();
      console.log('📑 MongoDB indexes synced');
      return;

    } catch (err) {
      attempt++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  MongoDB attempt ${attempt}/${maxRetries} failed: ${msg}`);

      if (attempt >= maxRetries) {
        console.error(
          '❌ Could not connect to MongoDB after all retries.\n' +
          '   Running in memory-only mode — data will not persist between restarts.\n' +
          '   Make sure MongoDB is running: mongod --dbpath <your-path>'
        );
        return; // Don't throw — allow app to run without DB
      }

      const delay = 2000 * attempt;
      console.log(`   Retrying in ${delay / 1000}s…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// ── Helper to check connection state ──
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// ── Get connection stats for health endpoint ──
export function getDbStats(): { status: string; host?: string; dbName?: string } {
  const state = mongoose.connection.readyState;
  const stateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return {
    status: stateMap[state] ?? 'unknown',
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
  };
}
