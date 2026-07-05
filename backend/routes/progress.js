import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET /api/progress - Fetch study progress and history
router.get('/', async (req, res, next) => {
  try {
    const progress = await db.progress.get();
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

// POST /api/progress/quiz-result - Submit a quiz score to update progress
router.post('/quiz-result', async (req, res, next) => {
  try {
    const { score, totalQuestions, quizTitle } = req.body;
    if (score === undefined || !totalQuestions) {
      return res.status(400).json({ error: 'score and totalQuestions are required' });
    }

    const percentage = Math.round((score / totalQuestions) * 100);

    const updatedProgress = await db.progress.update(prog => {
      const currentQuizAttempts = prog.totalQuizAttempts || 0;
      const currentAvg = prog.averageQuizScore || 0;

      // Calculate running average
      prog.averageQuizScore = Math.round(
        ((currentAvg * currentQuizAttempts) + percentage) / (currentQuizAttempts + 1)
      );
      prog.totalQuizAttempts = currentQuizAttempts + 1;
    });

    // Log the quiz completion
    await db.progress.logActivity(
      'Completed Quiz',
      `Scored ${score}/${totalQuestions} (${percentage}%) on "${quizTitle || 'Quiz'}"`
    );

    res.json({
      message: 'Quiz score submitted successfully',
      progress: updatedProgress
    });
  } catch (error) {
    next(error);
  }
});

export default router;
