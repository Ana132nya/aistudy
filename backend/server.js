import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db.js';
import documentRouter from './routes/documents.js';
import aiRouter from './routes/ai.js';
import progressRouter from './routes/progress.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/documents', documentRouter);
app.use('/api/ai', aiRouter);
app.use('/api/progress', progressRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: {
      geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
      nodeVersion: process.version
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Connect to DB and start Server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] Express server listening on http://localhost:${PORT}`);
  });
};

startServer();
