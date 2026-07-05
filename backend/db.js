import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data folder exists for JSON fallback
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let isMongoConnected = false;
const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/aistudy';

const sanitizeMongoUri = (rawUri = DEFAULT_MONGO_URI) => {
  const trimmedUri = rawUri.trim();
  return /\s/.test(trimmedUri) ? trimmedUri.replace(/\s+/g, '') : trimmedUri;
};

const redactMongoUri = (mongoURI) => {
  try {
    const parsedUri = new URL(mongoURI);
    if (parsedUri.username) {
      parsedUri.username = '***';
    }
    if (parsedUri.password) {
      parsedUri.password = '***';
    }
    return parsedUri.toString();
  } catch {
    return '[invalid MongoDB URI]';
  }
};

const assertValidMongoUri = (mongoURI) => {
  let parsedUri;
  try {
    parsedUri = new URL(mongoURI);
  } catch {
    throw new Error('Invalid MONGODB_URI format.');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://.');
  }
};

// Connect to MongoDB
export const connectDB = async () => {
  const mongoURI = sanitizeMongoUri(process.env.MONGODB_URI || DEFAULT_MONGO_URI);
  console.log(`[Database] Attempting to connect to MongoDB at ${redactMongoUri(mongoURI)}...`);
  try {
    assertValidMongoUri(mongoURI);

    // Keep startup responsive so JSON fallback becomes available quickly if Mongo isn't reachable.
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 3000
    });
    isMongoConnected = true;
    console.log('[Database] MongoDB connected successfully.');
  } catch (error) {
    await mongoose.disconnect().catch(() => {});
    console.warn(`[Database] MongoDB connection failed: ${error.message}`);
    console.warn('[Database] Falling back to localized JSON database storage.');
    isMongoConnected = false;
  }
};

// --- Mongoose Schemas ---
const DocumentSchema = new mongoose.Schema({
  title: String,
  text: String,
  charCount: Number,
  createdAt: { type: Date, default: Date.now }
});

const NotesSchema = new mongoose.Schema({
  documentId: String,
  title: String,
  contentMarkdown: String,
  createdAt: { type: Date, default: Date.now }
});

const QuizSchema = new mongoose.Schema({
  documentId: String,
  title: String,
  questions: [{
    question: String,
    options: [String],
    correctAnswerIndex: Number,
    explanation: String
  }],
  createdAt: { type: Date, default: Date.now }
});

const FlashcardSchema = new mongoose.Schema({
  documentId: String,
  title: String,
  cards: [{
    id: String,
    front: String,
    back: String,
    mastered: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now }
});

const ProgressSchema = new mongoose.Schema({
  totalDocuments: { type: Number, default: 0 },
  totalNotes: { type: Number, default: 0 },
  totalQuizzes: { type: Number, default: 0 },
  totalQuizAttempts: { type: Number, default: 0 },
  totalFlashcards: { type: Number, default: 0 },
  flashcardsMastered: { type: Number, default: 0 },
  averageQuizScore: { type: Number, default: 0 },
  studyStreak: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  historyLog: [{
    date: String, // YYYY-MM-DD
    action: String, // e.g. "Uploaded PDF", "Completed Quiz", "Mastered Flashcards"
    details: String
  }]
});

const DocumentModel = mongoose.model('Document', DocumentSchema);
const NotesModel = mongoose.model('Notes', NotesSchema);
const QuizModel = mongoose.model('Quiz', QuizSchema);
const FlashcardModel = mongoose.model('Flashcard', FlashcardSchema);
const ProgressModel = mongoose.model('Progress', ProgressSchema);

// --- JSON File Helpers ---
const readJsonFile = (filename, defaultValue = []) => {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Error reading file ${filename}:`, err);
    return defaultValue;
  }
};

const writeJsonFile = (filename, data) => {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// --- Unified Database Interface ---
export const db = {
  documents: {
    find: async () => {
      if (isMongoConnected) return await DocumentModel.find().sort({ createdAt: -1 });
      return readJsonFile('documents.json').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    findById: async (id) => {
      if (isMongoConnected) return await DocumentModel.findById(id);
      const docs = readJsonFile('documents.json');
      return docs.find(d => d._id === id) || null;
    },
    create: async (data) => {
      if (isMongoConnected) return await DocumentModel.create(data);
      const docs = readJsonFile('documents.json');
      const newDoc = { _id: generateId(), createdAt: new Date().toISOString(), ...data };
      docs.push(newDoc);
      writeJsonFile('documents.json', docs);
      return newDoc;
    },
    delete: async (id) => {
      if (isMongoConnected) return await DocumentModel.findByIdAndDelete(id);
      let docs = readJsonFile('documents.json');
      docs = docs.filter(d => d._id !== id);
      writeJsonFile('documents.json', docs);
      // Clean up related resources as well
      await db.notes.deleteByDoc(id);
      await db.quizzes.deleteByDoc(id);
      await db.flashcards.deleteByDoc(id);
      return { success: true };
    }
  },

  notes: {
    find: async (query = {}) => {
      if (isMongoConnected) return await NotesModel.find(query).sort({ createdAt: -1 });
      const notes = readJsonFile('notes.json');
      return notes
        .filter(n => !query.documentId || n.documentId === query.documentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    create: async (data) => {
      if (isMongoConnected) return await NotesModel.create(data);
      const notes = readJsonFile('notes.json');
      const newNote = { _id: generateId(), createdAt: new Date().toISOString(), ...data };
      notes.push(newNote);
      writeJsonFile('notes.json', notes);
      return newNote;
    },
    deleteByDoc: async (docId) => {
      if (isMongoConnected) return await NotesModel.deleteMany({ documentId: docId });
      let notes = readJsonFile('notes.json');
      notes = notes.filter(n => n.documentId !== docId);
      writeJsonFile('notes.json', notes);
    }
  },

  quizzes: {
    find: async (query = {}) => {
      if (isMongoConnected) return await QuizModel.find(query).sort({ createdAt: -1 });
      const quizzes = readJsonFile('quizzes.json');
      return quizzes
        .filter(q => !query.documentId || q.documentId === query.documentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    findById: async (id) => {
      if (isMongoConnected) return await QuizModel.findById(id);
      const quizzes = readJsonFile('quizzes.json');
      return quizzes.find(q => q._id === id) || null;
    },
    create: async (data) => {
      if (isMongoConnected) return await QuizModel.create(data);
      const quizzes = readJsonFile('quizzes.json');
      const newQuiz = { _id: generateId(), createdAt: new Date().toISOString(), ...data };
      quizzes.push(newQuiz);
      writeJsonFile('quizzes.json', quizzes);
      return newQuiz;
    },
    deleteByDoc: async (docId) => {
      if (isMongoConnected) return await QuizModel.deleteMany({ documentId: docId });
      let quizzes = readJsonFile('quizzes.json');
      quizzes = quizzes.filter(q => q.documentId !== docId);
      writeJsonFile('quizzes.json', quizzes);
    }
  },

  flashcards: {
    find: async (query = {}) => {
      if (isMongoConnected) return await FlashcardModel.find(query).sort({ createdAt: -1 });
      const decks = readJsonFile('flashcards.json');
      return decks
        .filter(d => !query.documentId || d.documentId === query.documentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    findById: async (id) => {
      if (isMongoConnected) return await FlashcardModel.findById(id);
      const decks = readJsonFile('flashcards.json');
      return decks.find(d => d._id === id) || null;
    },
    create: async (data) => {
      if (isMongoConnected) return await FlashcardModel.create(data);
      const decks = readJsonFile('flashcards.json');
      const newDeck = { _id: generateId(), createdAt: new Date().toISOString(), ...data };
      decks.push(newDeck);
      writeJsonFile('flashcards.json', decks);
      return newDeck;
    },
    updateCardStatus: async (deckId, cardId, mastered) => {
      if (isMongoConnected) {
        return await FlashcardModel.findOneAndUpdate(
          { _id: deckId, 'cards.id': cardId },
          { $set: { 'cards.$.mastered': mastered } },
          { new: true }
        );
      }
      const decks = readJsonFile('flashcards.json');
      const deck = decks.find(d => d._id === deckId);
      if (deck) {
        const card = deck.cards.find(c => c.id === cardId);
        if (card) {
          card.mastered = mastered;
          writeJsonFile('flashcards.json', decks);
        }
      }
      return deck;
    },
    deleteByDoc: async (docId) => {
      if (isMongoConnected) return await FlashcardModel.deleteMany({ documentId: docId });
      let decks = readJsonFile('flashcards.json');
      decks = decks.filter(d => d.documentId !== docId);
      writeJsonFile('flashcards.json', decks);
    }
  },

  progress: {
    get: async () => {
      if (isMongoConnected) {
        let prog = await ProgressModel.findOne();
        if (!prog) {
          prog = await ProgressModel.create({});
        }
        return prog;
      }
      const prog = readJsonFile('progress.json', {
        totalDocuments: 0,
        totalNotes: 0,
        totalQuizzes: 0,
        totalQuizAttempts: 0,
        totalFlashcards: 0,
        flashcardsMastered: 0,
        averageQuizScore: 0,
        studyStreak: 0,
        lastActive: new Date().toISOString(),
        historyLog: []
      });
      // Handle array structure initialization
      if (!prog.historyLog) prog.historyLog = [];
      if (typeof prog.totalQuizAttempts !== 'number') prog.totalQuizAttempts = 0;
      return prog;
    },
    update: async (updateFn) => {
      if (isMongoConnected) {
        let prog = await ProgressModel.findOne();
        if (!prog) prog = new ProgressModel({});
        updateFn(prog);
        await prog.save();
        return prog;
      }
      const prog = await db.progress.get();
      updateFn(prog);
      writeJsonFile('progress.json', prog);
      return prog;
    },
    logActivity: async (action, details) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const updateFn = (prog) => {
        // Calculate streak
        const lastActiveDate = prog.lastActive ? new Date(prog.lastActive).toISOString().split('T')[0] : '';
        if (lastActiveDate) {
          const lastActiveTime = new Date(lastActiveDate).getTime();
          const todayTime = new Date(todayStr).getTime();
          const diffDays = Math.round((todayTime - lastActiveTime) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            prog.studyStreak += 1;
          } else if (diffDays > 1) {
            prog.studyStreak = 1; // reset if missed a day
          } else if (prog.studyStreak === 0) {
            prog.studyStreak = 1; // start streak
          }
        } else {
          prog.studyStreak = 1;
        }
        prog.lastActive = new Date().toISOString();
        
        // Push to history logs
        if (!prog.historyLog) prog.historyLog = [];
        prog.historyLog.unshift({
          date: todayStr,
          action,
          details
        });
        // Limit logs to 50
        if (prog.historyLog.length > 50) {
          prog.historyLog = prog.historyLog.slice(0, 50);
        }
      };
      return await db.progress.update(updateFn);
    }
  }
};
