import express from 'express';
import multer from 'multer';
import pdf from 'pdf-parse';
import { db } from '../db.js';

const router = express.Router();

// Configure Multer for in-memory file handling
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET /api/documents - Get all documents
router.get('/', async (req, res, next) => {
  try {
    const docs = await db.documents.find();
    // Return documents with text preview instead of full text to optimize payload size
    const previewDocs = docs.map(doc => ({
      _id: doc._id,
      title: doc.title,
      charCount: doc.charCount,
      createdAt: doc.createdAt,
      textPreview: doc.text ? doc.text.substring(0, 150) + '...' : ''
    }));
    res.json(previewDocs);
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/:id - Get a specific document
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.documents.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/upload - Upload and parse PDF
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported' });
    }

    console.log(`[Document] Processing PDF: ${req.file.originalname} (${req.file.size} bytes)...`);

    // Parse the PDF buffer
    let parsedText = '';
    try {
      const pdfData = await pdf(req.file.buffer);
      parsedText = pdfData.text || '';
    } catch (parseErr) {
      console.error('[Document] PDF parsing failed:', parseErr);
      return res.status(422).json({ error: 'Failed to extract text from PDF. Ensure the file is not corrupted.' });
    }

    // Clean up empty lines / excessive spaces
    const cleanText = parsedText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();

    if (!cleanText || cleanText.length < 20) {
      return res.status(422).json({
        error: 'The PDF seems to contain very little extractable text. It might be scanned images.'
      });
    }

    // Save to DB
    const newDoc = await db.documents.create({
      title: req.file.originalname.replace(/\.pdf$/i, ''),
      text: cleanText,
      charCount: cleanText.length
    });

    // Update progress stats
    await db.progress.update(prog => {
      prog.totalDocuments = (prog.totalDocuments || 0) + 1;
    });

    // Log activity
    await db.progress.logActivity(
      'Uploaded Document',
      `Uploaded and analyzed "${newDoc.title}" (${Math.round(cleanText.length / 1000)}k characters)`
    );

    console.log(`[Document] Successfully processed "${newDoc.title}". Saved to DB.`);

    res.status(201).json({
      message: 'Document uploaded and parsed successfully',
      document: {
        _id: newDoc._id,
        title: newDoc.title,
        charCount: newDoc.charCount,
        createdAt: newDoc.createdAt,
        textPreview: cleanText.substring(0, 150) + '...'
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/documents/:id - Delete a document
router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.documents.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const title = doc.title;
    const [notes, quizzes, decks] = await Promise.all([
      db.notes.find({ documentId: req.params.id }),
      db.quizzes.find({ documentId: req.params.id }),
      db.flashcards.find({ documentId: req.params.id })
    ]);
    const deletedFlashcardCount = decks.reduce((count, deck) => count + (deck.cards?.length || 0), 0);
    const deletedMasteredCount = decks.reduce(
      (count, deck) => count + (deck.cards?.filter(card => card.mastered).length || 0),
      0
    );

    await db.documents.delete(req.params.id);

    // Update progress stats
    await db.progress.update(prog => {
      prog.totalDocuments = Math.max(0, (prog.totalDocuments || 0) - 1);
      prog.totalNotes = Math.max(0, (prog.totalNotes || 0) - notes.length);
      prog.totalQuizzes = Math.max(0, (prog.totalQuizzes || 0) - quizzes.length);
      prog.totalFlashcards = Math.max(0, (prog.totalFlashcards || 0) - deletedFlashcardCount);
      prog.flashcardsMastered = Math.max(0, (prog.flashcardsMastered || 0) - deletedMasteredCount);
    });

    // Log activity
    await db.progress.logActivity('Deleted Document', `Removed "${title}"`);

    res.json({ message: 'Document and all associated study materials deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
