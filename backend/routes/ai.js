import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db.js';

const router = express.Router();

// Helper to initialize Gemini API
const getGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
};

// Helper to clean JSON responses returned by LLM (strips markdown formatting)
const parseCleanJson = (rawText) => {
  let cleaned = rawText.trim();
  // Strip code block markers if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '');
    cleaned = cleaned.replace(/```$/i, '');
  }
  return JSON.parse(cleaned.trim());
};

// --- ROUTE ENDPOINTS ---

// GET /api/ai/notes/:documentId - Get existing notes for a document
router.get('/notes/:documentId', async (req, res, next) => {
  try {
    const notes = await db.notes.find({ documentId: req.params.documentId });
    res.json(notes[0] || null);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/generate-notes - Generate study notes
router.post('/generate-notes', async (req, res, next) => {
  try {
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ error: 'documentId is required' });

    const doc = await db.documents.findById(documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    console.log(`[AI] Generating notes for: ${doc.title}...`);

    const model = getGeminiModel();
    if (!model) {
      return res.status(500).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env'
      });
    }

    const prompt = `You are a world-class academic study assistant. 
Generate comprehensive, clear, and highly structured study notes in Markdown format from the following text.
Make use of clean Markdown headers, bullet points, bold text for key terms, blockquotes, and code blocks if appropriate.
Include a "Key Takeaways" section at the end.

Document Title: ${doc.title}
Document Text:
${doc.text}`;
    
    const result = await model.generateContent(prompt);
    const notesContent = result.response.text();

    // Save notes
    const newNote = await db.notes.create({
      documentId,
      title: `${doc.title} - Notes`,
      contentMarkdown: notesContent
    });

    // Update progress stats
    await db.progress.update(prog => {
      prog.totalNotes = (prog.totalNotes || 0) + 1;
    });
    await db.progress.logActivity('Generated Notes', `Created comprehensive notes for "${doc.title}"`);

    res.status(201).json(newNote);
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/quizzes/:documentId - Get existing quizzes for a document
router.get('/quizzes/:documentId', async (req, res, next) => {
  try {
    const quizzes = await db.quizzes.find({ documentId: req.params.documentId });
    res.json(quizzes);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/generate-quiz - Generate a quiz
router.post('/generate-quiz', async (req, res, next) => {
  try {
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ error: 'documentId is required' });

    const doc = await db.documents.findById(documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    console.log(`[AI] Generating quiz for: ${doc.title}...`);

    const model = getGeminiModel();
    if (!model) {
      return res.status(500).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env'
      });
    }

    const prompt = `You are an expert test creator.
Generate a multiple-choice quiz based on the text below. 
You must generate exactly 5 multiple-choice questions of varying difficulty.
You MUST output ONLY a valid JSON array. Do not include markdown code block markers (like \`\`\`json).
Each question must contain: "question" (string), "options" (array of 4 strings), "correctAnswerIndex" (number 0-3), and "explanation" (string explaining why it is correct).

Document Title: ${doc.title}
Document Text:
${doc.text}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });
    const rawText = result.response.text();
    const questions = parseCleanJson(rawText);

    // Save quiz
    const newQuiz = await db.quizzes.create({
      documentId,
      title: `${doc.title} - Quiz`,
      questions
    });

    // Update progress stats
    await db.progress.update(prog => {
      prog.totalQuizzes = (prog.totalQuizzes || 0) + 1;
    });
    await db.progress.logActivity('Created Quiz', `Generated an interactive quiz for "${doc.title}"`);

    res.status(201).json(newQuiz);
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/flashcards/:documentId - Get existing flashcards for a document
router.get('/flashcards/:documentId', async (req, res, next) => {
  try {
    const decks = await db.flashcards.find({ documentId: req.params.documentId });
    res.json(decks[0] || null);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/generate-flashcards - Generate flashcard deck
router.post('/generate-flashcards', async (req, res, next) => {
  try {
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ error: 'documentId is required' });

    const doc = await db.documents.findById(documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    console.log(`[AI] Generating flashcards for: ${doc.title}...`);

    const model = getGeminiModel();
    if (!model) {
      return res.status(500).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env'
      });
    }

    const prompt = `You are a study flashcard specialist.
Create a deck of double-sided active recall study flashcards based on the text below.
You must generate exactly 6-8 flashcards.
You MUST output ONLY a valid JSON array. Do not include markdown code block markers (like \`\`\`json).
Each card must contain: "id" (unique short string), "front" (question/term to recall), "back" (answer/definition on flip), and "mastered" (boolean set to false).

Document Title: ${doc.title}
Document Text:
${doc.text}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });
    const rawText = result.response.text();
    const cards = parseCleanJson(rawText);

    // Save flashcards
    const newDeck = await db.flashcards.create({
      documentId,
      title: `${doc.title} - Flashcard Deck`,
      cards
    });

    // Update progress stats
    await db.progress.update(prog => {
      prog.totalFlashcards = (prog.totalFlashcards || 0) + cards.length;
    });
    await db.progress.logActivity('Created Flashcards', `Generated ${cards.length} active recall cards for "${doc.title}"`);

    res.status(201).json(newDeck);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/flashcards/:deckId/cards/:cardId/status - Update card mastered status
router.post('/flashcards/:deckId/cards/:cardId/status', async (req, res, next) => {
  try {
    const { deckId, cardId } = req.params;
    const { mastered } = req.body;

    const deck = await db.flashcards.findById(deckId);
    if (!deck) return res.status(404).json({ error: 'Flashcard deck not found' });

    // Track old status to update progress
    const card = deck.cards.find(c => c.id === cardId || c._id?.toString() === cardId);
    if (!card) return res.status(404).json({ error: 'Card not found in deck' });

    const wasMastered = card.mastered;
    const updatedDeck = await db.flashcards.updateCardStatus(deckId, cardId, mastered);

    // Update global progress metrics
    if (wasMastered !== mastered) {
      await db.progress.update(prog => {
        prog.flashcardsMastered = Math.max(0, (prog.flashcardsMastered || 0) + (mastered ? 1 : -1));
      });
      if (mastered) {
        await db.progress.logActivity('Mastered Flashcard', `Learned a concept from deck "${deck.title}"`);
      }
    }

    res.json(updatedDeck);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/doubt-solve - Contextual study chat
router.post('/doubt-solve', async (req, res, next) => {
  try {
    const { documentId, question, history = [] } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });

    let docTitle = 'General Study Topic';
    let docText = 'No specific document selected. Provide general study advice.';

    if (documentId) {
      const doc = await db.documents.findById(documentId);
      if (doc) {
        docTitle = doc.title;
        docText = doc.text;
      }
    }

    console.log(`[AI] Doubt Solver query for doc "${docTitle}": ${question.substring(0, 40)}...`);

    const model = getGeminiModel();
    if (!model) {
      return res.status(500).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env'
      });
    }

    // Format chat history
    const formattedHistory = history.map(msg => 
      `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`
    ).join('\n');

    const prompt = `You are "QuantumTutor", a helpful, next-generation AI Study Assistant.
The user has uploaded a document titled "${docTitle}" with the following content:
---
${docText}
---
Answer the user's question, using the document context above. If the answer cannot be found in the document, answer using your general knowledge but mention it is not explicitly in the text.
Use clear, easy-to-read Markdown formatting. Keep your answer conversational, educational, and structured with bullet points or examples if it helps clarify complex details.

Here is our chat history:
${formattedHistory}

User's New Question: ${question}
AI Tutor:`;

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    // Log chat interaction in progress
    await db.progress.logActivity('Solved Doubt', `Asked AI tutor about: "${question.substring(0, 30)}..."`);

    res.json({ answer: aiResponse });
  } catch (error) {
    next(error);
  }
});

export default router;
