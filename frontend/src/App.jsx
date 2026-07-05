import React, { useState, useEffect, useRef } from 'react';

// API Base URL
const API_BASE = 'http://localhost:5000/api';

// Custom Markdown Renderer
const renderMarkdown = (text) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  let inList = false;
  let listItems = [];
  const elements = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Handle code blocks
    if (line.startsWith('```')) {
      let codeText = '';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeText += lines[i] + '\n';
        i++;
      }
      elements.push(
        <pre key={`code-${i}`} style={{ background: '#020305', padding: '16px', borderRadius: '8px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px', fontFamily: 'monospace', fontSize: '13px' }}>
          <code>{codeText}</code>
        </pre>
      );
      continue;
    }
    
    // Close list if line is not a list item
    if (!line.startsWith('- ') && !line.match(/^\d+\.\s/) && inList) {
      elements.push(<ul key={`list-${i}`} style={{ marginLeft: '20px', marginBottom: '16px', fontSize: '14px', color: '#d4d4d8', listStyleType: 'disc' }}>{listItems}</ul>);
      listItems = [];
      inList = false;
    }

    if (line === '') {
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontFamily: 'var(--font-title)', fontSize: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginTop: '24px', marginBottom: '12px' }}>{parseInlineMarkdown(line.substring(2))}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontFamily: 'var(--font-title)', fontSize: '20px', marginTop: '24px', marginBottom: '12px' }}>{parseInlineMarkdown(line.substring(3))}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontFamily: 'var(--font-title)', fontSize: '16px', marginTop: '24px', marginBottom: '12px' }}>{parseInlineMarkdown(line.substring(4))}</h3>);
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ borderLeft: '3px solid var(--primary-purple)', background: 'rgba(134, 39, 255, 0.03)', padding: '12px 16px', marginBottom: '16px', borderRadius: '0 8px 8px 0', fontStyle: 'italic' }}>
          {parseInlineMarkdown(line.substring(2))}
        </blockquote>
      );
    }
    // List item
    else if (line.startsWith('- ')) {
      inList = true;
      listItems.push(<li key={`li-${i}`} style={{ marginBottom: '6px' }}>{parseInlineMarkdown(line.substring(2))}</li>);
    }
    else if (line.match(/^\d+\.\s/)) {
      inList = true;
      const content = line.replace(/^\d+\.\s/, '');
      listItems.push(<li key={`li-${i}`} style={{ marginBottom: '6px' }}>{parseInlineMarkdown(content)}</li>);
    }
    // Regular paragraph
    else {
      elements.push(<p key={i} style={{ marginBottom: '16px', fontSize: '14px', color: '#d4d4d8', lineHeight: '1.65' }}>{parseInlineMarkdown(line)}</p>);
    }
  }

  if (inList && listItems.length > 0) {
    elements.push(<ul key="list-final" style={{ marginLeft: '20px', marginBottom: '16px', fontSize: '14px', color: '#d4d4d8', listStyleType: 'disc' }}>{listItems}</ul>);
  }

  return <div className="markdown-body">{elements}</div>;
};

const parseInlineMarkdown = (text) => {
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const splitParts = text.split(regex);
  
  return splitParts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} style={{ color: '#fff', fontWeight: '700' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--primary-cyan)' }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

function App() {
  // Navigation & User Authentication State
  const [isLanding, setIsLanding] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState('signin'); // 'signin' or 'signup'
  const [user, setUser] = useState(null);

  // Form Inputs
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [currentView, setCurrentView] = useState('dashboard');
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [progress, setProgress] = useState({
    totalDocuments: 0,
    totalNotes: 0,
    totalQuizzes: 0,
    totalFlashcards: 0,
    flashcardsMastered: 0,
    averageQuizScore: 0,
    studyStreak: 0,
    historyLog: []
  });
  const [apiConfigured, setApiConfigured] = useState(true);

  // Notes state
  const [currentNote, setCurrentNote] = useState(null);
  const [notesLoading, setNotesLoading] = useState(false);

  // Quiz state
  const [quizzes, setQuizzes] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);

  // Flashcards state
  const [flashcardDeck, setFlashcardDeck] = useState(null);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [flashcardLoading, setFlashcardLoading] = useState(false);

  // Doubt Solver Chat
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Hello! I am your AI Study Tutor. Select a document or ask me any general doubt regarding your studies.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Document Upload
  const [isDragging, setIsDragging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Landing Page Interactive Playground & Code Selector State
  const [playTab, setPlayTab] = useState('notes');
  const [playInputText, setPlayInputText] = useState('Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight and turn it into chemical energy. It requires carbon dioxide, water, and light energy to produce glucose and oxygen.');
  const [playNotesResult, setPlayNotesResult] = useState(
    `# Study Notes: Photosynthesis\n\n## Overview\nPlants, algae, and bacteria convert **sunlight** into **chemical energy** (glucose).\n\n## Chemical Equation\n- **Reactants**: 6CO₂ + 6H₂O + light energy\n- **Products**: C₆H₁₂O₆ + 6O₂\n\n## Key Takeaways\n1. Requires carbon dioxide, water, and light.\n2. Produces glucose (energy) and releases oxygen.`
  );
  const [playQuizSelected, setPlayQuizSelected] = useState(null);
  const [playFlashcardFlipped, setPlayFlashcardFlipped] = useState(false);
  const [playChatInput, setPlayChatInput] = useState('');
  const [playChatMessages, setPlayChatMessages] = useState([
    { sender: 'user', text: 'Explain the difference between light-dependent and light-independent reactions.' },
    { sender: 'ai', text: 'Light-dependent reactions require direct sunlight to split water molecules and produce ATP and NADPH. Light-independent reactions (Calvin Cycle) use that ATP and NADPH to fix carbon dioxide into glucose, and can occur in the dark!' }
  ]);


  // Load persistence
  useEffect(() => {
    const savedUser = localStorage.getItem('study_assistant_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsLanding(false);
    }

    const initializeApp = async () => {
      try {
        const docsRes = await fetch(`${API_BASE}/documents`);
        if (docsRes.ok) {
          const docs = await docsRes.json();
          setDocuments(docs);
          setSelectedDocId(prevSelectedDocId => {
            if (docs.length === 0) {
              return '';
            }
            if (prevSelectedDocId && docs.some(doc => doc._id === prevSelectedDocId)) {
              return prevSelectedDocId;
            }
            return docs[0]._id;
          });
        }
      } catch (error) {
        console.error('Error fetching documents', error);
      }

      try {
        const progressRes = await fetch(`${API_BASE}/progress`);
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          setProgress(progressData);
        }
      } catch (error) {
        console.error('Error fetching progress', error);
      }

      try {
        const healthRes = await fetch(`${API_BASE}/health`);
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setApiConfigured(healthData.env.geminiKeyConfigured);
        }
      } catch (error) {
        console.error('Health check failed', error);
      }
    };

    initializeApp();
  }, []);

  // Scroll Chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Handle document selection change
  useEffect(() => {
    if (selectedDocId) {
      fetchNotesForDoc(selectedDocId);
      fetchQuizzesForDoc(selectedDocId);
      fetchFlashcardsForDoc(selectedDocId);
    } else {
      setCurrentNote(null);
      setQuizzes([]);
      setActiveQuiz(null);
      setFlashcardDeck(null);
    }
  }, [selectedDocId]);

  const checkApiStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        setApiConfigured(data.env.geminiKeyConfigured);
      }
    } catch (e) {
      console.error("Health check failed", e);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        setSelectedDocId(prevSelectedDocId => {
          if (data.length === 0) {
            return '';
          }
          if (prevSelectedDocId && data.some(doc => doc._id === prevSelectedDocId)) {
            return prevSelectedDocId;
          }
          return data[0]._id;
        });
      }
    } catch (error) {
      console.error('Error fetching documents', error);
    }
  };

  const fetchProgress = async () => {
    try {
      const res = await fetch(`${API_BASE}/progress`);
      if (res.ok) {
        const data = await res.json();
        setProgress(data);
      }
    } catch (error) {
      console.error('Error fetching progress', error);
    }
  };

  const fetchNotesForDoc = async (docId) => {
    setNotesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/notes/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentNote(data);
      }
    } catch (error) {
      console.error('Error fetching notes', error);
    } finally {
      setNotesLoading(false);
    }
  };

  const fetchQuizzesForDoc = async (docId) => {
    try {
      const res = await fetch(`${API_BASE}/ai/quizzes/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
        if (data.length > 0) {
          setActiveQuiz(null);
        }
      }
    } catch (error) {
      console.error('Error fetching quizzes', error);
    }
  };

  const fetchFlashcardsForDoc = async (docId) => {
    try {
      const res = await fetch(`${API_BASE}/ai/flashcards/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setFlashcardDeck(data);
        setFlashcardIndex(0);
        setFlashcardFlipped(false);
      }
    } catch (error) {
      console.error('Error fetching flashcards', error);
    }
  };

  // --- ACTIONS ---

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setAuthError('Please fill in all credentials.');
      return;
    }
    setAuthError('');
    setAuthLoading(true);

    setTimeout(() => {
      const activeUsername = authTab === 'signup' && usernameInput ? usernameInput : emailInput.split('@')[0];
      const authenticatedUser = {
        email: emailInput,
        username: activeUsername
      };
      
      localStorage.setItem('study_assistant_user', JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      setAuthLoading(false);
      setAuthModalOpen(false);
      setIsLanding(false);
      
      setEmailInput('');
      setPasswordInput('');
      setUsernameInput('');
    }, 1200);
  };


  const handleSignOut = () => {
    localStorage.removeItem('study_assistant_user');
    setUser(null);
    setIsLanding(true);
    setCurrentView('dashboard');
  };

  // File drag & upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are allowed.');
      return;
    }
    setUploadError('');
    setUploadLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDocuments();
        await fetchProgress();
        setSelectedDocId(data.document._id);
        setCurrentView('documents');
      } else {
        setUploadError(data.error || 'Failed to upload PDF.');
      }
    } catch (error) {
      setUploadError('Network error uploading file.');
      console.error(error);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const deleteDocument = async (docId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document? All generated materials will be deleted.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (selectedDocId === docId) {
          setSelectedDocId('');
        }
        await fetchDocuments();
        await fetchProgress();
      }
    } catch (error) {
      console.error('Error deleting document', error);
    }
  };

  // Notes AI
  const generateNotes = async () => {
    if (!selectedDocId) return;
    setNotesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/generate-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocId })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentNote(data);
        await fetchProgress();
      }
    } catch (error) {
      console.error('Error generating notes', error);
    } finally {
      setNotesLoading(false);
    }
  };

  // Quiz AI
  const generateQuiz = async () => {
    if (!selectedDocId) return;
    setQuizLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocId })
      });
      if (res.ok) {
        await fetchQuizzesForDoc(selectedDocId);
        await fetchProgress();
      }
    } catch (error) {
      console.error('Error generating quiz', error);
    } finally {
      setQuizLoading(false);
    }
  };

  // Flashcard AI
  const generateFlashcards = async () => {
    if (!selectedDocId) return;
    setFlashcardLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/generate-flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocId })
      });
      if (res.ok) {
        await fetchFlashcardsForDoc(selectedDocId);
        await fetchProgress();
      }
    } catch (error) {
      console.error('Error generating flashcards', error);
    } finally {
      setFlashcardLoading(false);
    }
  };

  // Mastery status
  const handleCardMastery = async (cardId, mastered) => {
    if (!flashcardDeck) return;
    try {
      const res = await fetch(`${API_BASE}/ai/flashcards/${flashcardDeck._id}/cards/${cardId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mastered })
      });
      if (res.ok) {
        const updatedDeck = await res.json();
        setFlashcardDeck(updatedDeck);
        await fetchProgress();
        
        setTimeout(() => {
          setFlashcardFlipped(false);
          setTimeout(() => {
            if (flashcardIndex < updatedDeck.cards.length - 1) {
              setFlashcardIndex(prev => prev + 1);
            } else {
              setFlashcardIndex(0);
            }
          }, 300);
        }, 600);
      }
    } catch (error) {
      console.error('Error updating flashcard status', error);
    }
  };

  // Submit test
  const submitQuizAnswers = async () => {
    let score = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctAnswerIndex) {
        score++;
      }
    });

    try {
      const res = await fetch(`${API_BASE}/progress/quiz-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          totalQuestions: quizQuestions.length,
          quizTitle: activeQuiz.title
        })
      });
      if (res.ok) {
        setQuizSubmitted(true);
        setQuizScore(score);
        await fetchProgress();
      }
    } catch (error) {
      console.error('Error submitting quiz score', error);
    }
  };

  const startQuizTaker = (quiz) => {
    setActiveQuiz(quiz);
    setQuizQuestions(quiz.questions);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(0);
    setCurrentQuestionIndex(0);
  };

  // Doubt chatbot
  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = {
      sender: 'user',
      text: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    const currentQuestion = chatInput;
    setChatInput('');
    setChatLoading(true);

    try {
      const chatHistory = chatMessages.slice(-4).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await fetch(`${API_BASE}/ai/doubt-solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocId,
          question: currentQuestion,
          history: chatHistory
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, {
          sender: 'ai',
          text: data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        await fetchProgress();
      }
    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Error connecting to tutor session.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getSelectedDocTitle = () => {
    const doc = documents.find(d => d._id === selectedDocId);
return doc ? doc.title : 'No document selected';
  };

  // ==================== RENDERING LAYOUT ====================

  // RENDER: TURBO.AI INSPIRED
  if (isLanding) {
    // Playground Mock Actions
    const handlePlaygroundSummarize = () => {
      const summaryLength = playInputText.split(/\s+/).length;
      setPlayNotesResult(
        `# Study Notes: Custom Summary\n\n## Overview\nYour uploaded textbook excerpt has been summarized successfully (${summaryLength} words input).\n\n## Summary Details\n- **Core Theme**: Study analysis of your custom text context.\n- **Keywords Identified**: ${playInputText.split(/\s+/).slice(0, 4).join(', ')}.\n\n## Key Takeaways\n1. Automatically parsed slide/content elements.\n2. Summarized into clean headings and bulleted concepts.`
      );
    };

    const handlePlayChatSubmit = (e) => {
      e.preventDefault();
      if (!playChatInput.trim()) return;

      const userMsg = { sender: 'user', text: playChatInput };
      setPlayChatMessages(prev => [...prev, userMsg]);
      const currentInput = playChatInput;
      setPlayChatInput('');

      setTimeout(() => {
        setPlayChatMessages(prev => [...prev, {
          sender: 'ai',
          text: `I've analyzed your query regarding "${currentInput}". In academic contexts, it's best to relate this to the main textbook principles and verify definitions. Let me know if you need more custom quiz or flashcard samples on this!`
        }]);
      }, 600);
    };



    return (
      <div className="turbo-wrapper">
        <header className="sarvam-header">
          <nav className="sarvam-nav-pill">
            <div className="sarvam-logo" onClick={() => setIsLanding(true)}>
              <div className="sarvam-logo-icon">Q</div>
              <span className="sarvam-logo-text">QuantumStudy</span>
            </div>

            <div className="sarvam-nav-actions">
              <button className="sarvam-nav-btn sarvam-nav-btn-secondary" onClick={() => { setAuthTab('signin'); setAuthModalOpen(true); }}>
                Sign In
              </button>
              <button className="sarvam-nav-btn sarvam-nav-btn-primary" onClick={() => { setAuthTab('signup'); setAuthModalOpen(true); }}>
                Start free
              </button>
            </div>
          </nav>
        </header>

        <section className="sarvam-hero">
          <a className="sarvam-announcement" href="#playground">
            <span>🚀</span>
            <span>Introducing QuantumStudy Playground - Try now</span>
            <span style={{ color: '#4f46e5', fontWeight: 600 }}>→</span>
          </a>

          <h1 className="sarvam-h1">
            India's Sovereign <span className="gradient">Academic AI</span> Platform
          </h1>
          <h2 className="sarvam-h2">
            Built for learners. Powered by frontier-class models. Delivering population-scale academic impact across institutions.
          </h2>
          
          <div className="sarvam-hero-actions">
            <button className="sarvam-cta-btn sarvam-cta-btn-primary" onClick={() => { setAuthTab('signup'); setAuthModalOpen(true); }}>
              Get Started for Free
            </button>
          </div>
        </section>

        <section id="playground" style={{ padding: '0 24px' }}>
          <div className="sarvam-playground">
            <div className="sarvam-play-header">
              <div className="sarvam-play-title">Try Quantum Study Playground</div>
              <div className="sarvam-play-tabs">
                <button className={`sarvam-play-tab ${playTab === 'notes' ? 'active' : ''}`} onClick={() => setPlayTab('notes')}>
                  Study Notes
                </button>
                <button className={`sarvam-play-tab ${playTab === 'quiz' ? 'active' : ''}`} onClick={() => { setPlayTab('quiz'); setPlayQuizSelected(null); }}>
                  Active Quizzes
                </button>
                <button className={`sarvam-play-tab ${playTab === 'flashcards' ? 'active' : ''}`} onClick={() => { setPlayTab('flashcards'); setPlayFlashcardFlipped(false); }}>
                  Flashcards
                </button>
                <button className={`sarvam-play-tab ${playTab === 'chat' ? 'active' : ''}`} onClick={() => setPlayTab('chat')}>
                  Doubt Solver
                </button>
              </div>
            </div>

            <div className="sarvam-play-content">
              {playTab === 'notes' && (
                <>
                  <div className="sarvam-play-left">
                    <div>
                      <label className="sarvam-label">Textbook Excerpt / Slides text</label>
                      <textarea 
                        className="sarvam-input" 
                        rows="6" 
                        value={playInputText}
                        onChange={(e) => setPlayInputText(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="sarvam-label">Summary Depth</label>
                      <select className="sarvam-select">
                        <option>Comprehensive Summary</option>
                        <option>Key Terms Only</option>
                        <option>Quick Review Questions</option>
                      </select>
                    </div>
                    <button className="sarvam-btn" onClick={handlePlaygroundSummarize}>
                      Generate Notes
                    </button>
                  </div>
                  <div className="sarvam-play-right">
                    <div className="markdown-body" style={{ fontSize: '13px', color: '#374151' }}>
                      {playNotesResult.split('\n').map((line, i) => {
                        if (line.startsWith('# ')) return <h1 key={i} style={{ fontSize: '18px', fontWeight: 700, margin: '12px 0 6px', color: '#111827' }}>{line.substring(2)}</h1>;
                        if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: '14px', fontWeight: 700, margin: '12px 0 6px', color: '#111827' }}>{line.substring(3)}</h2>;
                        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} style={{ marginLeft: '12px', listStyleType: 'disc' }}>{line.substring(2)}</li>;
                        if (line.match(/^\d+\.\s/)) return <li key={i} style={{ marginLeft: '12px', listStyleType: 'decimal' }}>{line.replace(/^\d+\.\s/, '')}</li>;
                        return <p key={i} style={{ margin: '6px 0' }}>{line}</p>;
                      })}
                    </div>
                  </div>
                </>
              )}

              {playTab === 'quiz' && (
                <>
                  <div className="sarvam-play-left" style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
                      Question: Which of the following is NOT required for photosynthesis?
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {['A) Carbon Dioxide', 'B) Water', 'C) Light Energy', 'D) Nitrogen Gas'].map((opt, idx) => {
                        let btnStyle = { border: '1px solid #d1d5db', background: '#ffffff', color: '#374151' };
                        if (playQuizSelected !== null) {
                          if (idx === 3) {
                            btnStyle = { border: '1px solid #10b981', background: '#e6f4ea', color: '#0f5132' };
                          } else if (playQuizSelected === idx) {
                            btnStyle = { border: '1px solid #ef4444', background: '#fdf2f2', color: '#842029' };
                          }
                        }
                        return (
                          <button 
                            key={idx} 
                            style={{ ...btnStyle, padding: '12px', borderRadius: '10px', fontSize: '13.5px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() => { if (playQuizSelected === null) setPlayQuizSelected(idx); }}
                            disabled={playQuizSelected !== null}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {playQuizSelected !== null && (
                      <button className="sarvam-btn" style={{ marginTop: '12px' }} onClick={() => setPlayQuizSelected(null)}>
                        Reset Quiz
                      </button>
                    )}
                  </div>
                  <div className="sarvam-play-right">
                    <label className="sarvam-label">Logical Explanation</label>
                    {playQuizSelected === null ? (
                      <p style={{ fontSize: '13.5px', color: '#6b7280', fontStyle: 'italic' }}>Select an option on the left to read the correct answer explanation.</p>
                    ) : (
                      <p style={{ fontSize: '13.5px', color: '#374151', lineHeight: '1.5' }}>
                        <strong>Correct Answer: D) Nitrogen Gas.</strong><br/><br/>
                        Photosynthesis uses carbon dioxide, water, and light energy to synthesise carbohydrates (glucose) and release oxygen as a byproduct. While plants need nitrogen for building proteins and amino acids, it is not direct reactant in the photosynthesis equation.
                      </p>
                    )}
                  </div>
                </>
              )}

              {playTab === 'flashcards' && (
                <>
                  <div className="sarvam-play-left">
                    <p style={{ fontSize: '14px', color: '#4b5563', textAlign: 'left' }}>
                      Spaced repetition helps you retain key lecture concepts. Toggle the card on the right to flip and view the answer definition.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="sarvam-btn" onClick={() => setPlayFlashcardFlipped(!playFlashcardFlipped)}>
                        Flip Card
                      </button>
                      <button className="sarvam-btn" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }} onClick={() => setPlayFlashcardFlipped(false)}>
                        Reset Deck
                      </button>
                    </div>
                  </div>
                  <div className="sarvam-play-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderLeft: 'none' }}>
                    <div 
                      className={`card-container ${playFlashcardFlipped ? 'flipped' : ''}`}
                      style={{ height: '220px', width: '100%', maxWidth: '320px', margin: 0 }}
                      onClick={() => setPlayFlashcardFlipped(!playFlashcardFlipped)}
                    >
                      <div className="card-inner">
                        <div className="card-front" style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                          <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 650, marginBottom: '10px', textTransform: 'uppercase' }}>Front Side</span>
                          <p style={{ fontSize: '14.5px', fontWeight: 600, color: '#111827' }}>What are the primary chemical products of the photosynthesis process?</p>
                        </div>
                        <div className="card-back" style={{ background: '#eef2ff', border: '1px solid #c7d2fe', boxShadow: '0 4px 20px rgba(79,70,229,0.05)' }}>
                          <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 650, marginBottom: '10px', textTransform: 'uppercase' }}>Back Side</span>
                          <p style={{ fontSize: '14.5px', fontWeight: 600, color: '#4338ca' }}>Glucose (C₆H₁₂O₆) and Oxygen (O₂)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {playTab === 'chat' && (
                <>
                  <div className="sarvam-play-left" style={{ textAlign: 'left' }}>
                    <label className="sarvam-label">AI Study Tutor Session</label>
                    <form onSubmit={handlePlayChatSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input 
                        type="text" 
                        className="sarvam-input" 
                        placeholder="Ask tutor a doubt (e.g. What is glucose?)..."
                        value={playChatInput}
                        onChange={(e) => setPlayChatInput(e.target.value)}
                      />
                      <button type="submit" className="sarvam-btn">Send Query</button>
                    </form>
                  </div>
                  <div className="sarvam-play-right" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid #4f46e5' }}>
                    {playChatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        style={{
                          alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                          background: msg.sender === 'user' ? '#f3f4f6' : '#ffffff',
                          border: '1px solid #e5e7eb',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          maxWidth: '85%',
                          fontSize: '13px',
                          color: '#374151',
                          lineHeight: 1.4
                        }}
                      >
                        <strong>{msg.sender === 'user' ? 'Student' : 'AI Tutor'}:</strong> {msg.text}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>



        <section className="sarvam-cta-section">
          <h2 className="sarvam-cta-title">Build the Future of Academic AI</h2>
          <p className="sarvam-cta-subtitle">Open your sandbox and start optimizing your studies today.</p>
          <button className="sarvam-cta-btn sarvam-cta-btn-primary" onClick={() => { setAuthTab('signup'); setAuthModalOpen(true); }}>
            Start Building for Free
          </button>
        </section>

        <footer className="sarvam-footer">
          <div className="sarvam-footer-container">
            <div className="sarvam-footer-about">
              <div className="sarvam-logo" onClick={() => setIsLanding(true)}>
                <div className="sarvam-logo-icon">Q</div>
                <span className="sarvam-logo-text">QuantumStudy</span>
              </div>
              <p className="sarvam-footer-tagline">
                India's Sovereign Academic AI Platform. Overhauling study tools and logic reasoning systems for next-generation learners.
              </p>
            </div>

            <div className="sarvam-footer-col">
              <h4>Products</h4>
              <ul className="sarvam-footer-links">
                <li><a className="sarvam-footer-link" href="#playground">Study Notes</a></li>
                <li><a className="sarvam-footer-link" href="#playground">Active Quizzes</a></li>
                <li><a className="sarvam-footer-link" href="#playground">Spaced Flashcards</a></li>
                <li><a className="sarvam-footer-link" href="#playground">Doubt Solver</a></li>
              </ul>
            </div>



            <div className="sarvam-footer-col">
              <h4>Company</h4>
              <ul className="sarvam-footer-links">
                <li><span className="sarvam-footer-link" style={{ cursor: 'pointer' }}>About Us</span></li>
                <li><span className="sarvam-footer-link" style={{ cursor: 'pointer' }}>Careers</span></li>
                <li><span className="sarvam-footer-link" style={{ cursor: 'pointer' }}>Blogs</span></li>
                <li><span className="sarvam-footer-link" style={{ cursor: 'pointer' }}>Trust Center</span></li>
              </ul>
            </div>

            <div className="sarvam-footer-col">
              <h4>Socials</h4>
              <ul className="sarvam-footer-links">
                <li><a className="sarvam-footer-link" href="https://linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
                <li><a className="sarvam-footer-link" href="https://x.com" target="_blank" rel="noopener noreferrer">X / Twitter</a></li>
                <li><a className="sarvam-footer-link" href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><a className="sarvam-footer-link" href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a></li>
              </ul>
            </div>
          </div>

          <div className="sarvam-footer-bottom">
            <address className="sarvam-footer-address">
              © {new Date().getFullYear()} QuantumStudy AI. All rights reserved.<br/>
              732, Academic Row, Indiranagar, Bengaluru, Karnataka 560038
            </address>
            <div className="sarvam-footer-copyright">
              India Sovereign AI Initiative
            </div>
          </div>
        </footer>

        {/* AUTH MODAL */}
        {authModalOpen && (
          <div className="modal-backdrop" onClick={() => setAuthModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{authTab === 'signin' ? 'Welcome Scholar' : 'Create Account'}</h3>
                <p style={{ color: 'var(--text-gray-400)', fontSize: '13px', marginTop: '4px' }}>
                  {authTab === 'signin' ? 'Enter credentials to open sandbox' : 'Join millions of next-gen learners'}
                </p>
              </div>

              <div className="modal-tabs">
                <button className={`modal-tab-btn ${authTab === 'signin' ? 'active' : ''}`} onClick={() => { setAuthTab('signin'); setAuthError(''); }}>
                  Sign In
                </button>
                <button className={`modal-tab-btn ${authTab === 'signup' ? 'active' : ''}`} onClick={() => { setAuthTab('signup'); setAuthError(''); }}>
                  Sign Up
                </button>
              </div>

              <form className="modal-form" onSubmit={handleAuthSubmit}>
                {authError && (
                  <div style={{ color: 'var(--error-red)', fontSize: '12px', textAlign: 'center', background: 'rgba(239,68,68,0.05)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.1)' }}>
                    {authError}
                  </div>
                )}

                {authTab === 'signup' && (
                  <div className="form-group">
                    <label>Username</label>
                    <input 
                      type="text" 
                      className="glass-input" 
                      placeholder="ScholarName" 
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="glass-input" 
                    placeholder="you@email.com" 
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="glass-input" 
                    placeholder="••••••••" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="glass-btn glass-btn-primary" style={{ marginTop: '10px' }} disabled={authLoading}>
                  {authLoading ? (
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                  ) : authTab === 'signin' ? (
                    'Enter Workspace'
                  ) : (
                    'Register Account'
                  )}
                </button>

              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RENDER: WORKSPACE WEB APP (AFTER AUTHENTICATION)
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">Q</div>
          <span className="logo-text">QuantumStudy</span>
        </div>

        {/* User Card */}
        <div style={{ padding: '12px 14px', background: 'var(--bg-dark)', border: '1px solid var(--border-muted)', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-purple), var(--primary-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
            {user?.username?.substring(0, 2).toUpperCase() || 'US'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user?.username || 'User Scholar'}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-gray-500)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-gray-500)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
            Active Document Context
          </label>
          <select 
            className="glass-input" 
            value={selectedDocId} 
            onChange={(e) => setSelectedDocId(e.target.value)}
            style={{ fontSize: '13px', background: '#ffffff', color: 'var(--text-white)' }}
          >
            <option value="" style={{ background: '#ffffff', color: 'var(--text-white)' }}>General (No Document)</option>
            {documents.map(doc => (
              <option key={doc._id} value={doc._id} style={{ background: '#ffffff', color: 'var(--text-white)' }}>
                {doc.title.length > 25 ? doc.title.substring(0, 25) + '...' : doc.title}
              </option>
            ))}
          </select>
        </div>

        <nav style={{ flex: 1 }}>
          <ul className="nav-links">
            <li className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
              Dashboard
            </li>
            <li className={`nav-item ${currentView === 'documents' ? 'active' : ''}`} onClick={() => setCurrentView('documents')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              PDF Upload
            </li>
            <li className={`nav-item ${currentView === 'notes' ? 'active' : ''}`} onClick={() => {
              setCurrentView('notes');
              if (selectedDocId) fetchNotesForDoc(selectedDocId);
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              AI Notes
            </li>
            <li className={`nav-item ${currentView === 'quizzes' ? 'active' : ''}`} onClick={() => {
              setCurrentView('quizzes');
              if (selectedDocId) fetchQuizzesForDoc(selectedDocId);
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              Quizzes
            </li>
            <li className={`nav-item ${currentView === 'flashcards' ? 'active' : ''}`} onClick={() => {
              setCurrentView('flashcards');
              if (selectedDocId) fetchFlashcardsForDoc(selectedDocId);
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>
              Flashcards
            </li>
            <li className={`nav-item ${currentView === 'chat' ? 'active' : ''}`} onClick={() => setCurrentView('chat')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Doubt Solver
            </li>
          </ul>
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--border-muted)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-gray-500)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: apiConfigured ? 'var(--success-green)' : 'var(--warning-amber)' }}></span>
            <span>{apiConfigured ? 'Gemini AI Online' : 'Gemini Offline'}</span>
          </div>
          <button className="glass-btn glass-btn-danger" style={{ padding: '8px', width: '100%', fontSize: '12px' }} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace content */}
      <main className="content-area">
        {!apiConfigured && (
          <div className="notice-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>âš ï¸ </span>
              <span><strong>Gemini API Key missing:</strong> AI functions are unavailable. Set <code>GEMINI_API_KEY</code> inside <code>backend/.env</code> and restart backend.</span>
            </div>
            <button className="glass-btn" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={checkApiStatus}>Sync AI</button>
          </div>
        )}

        {/* WORKSPACE VIEW: DASHBOARD */}
        {currentView === 'dashboard' && (
          <div>
            <div className="view-header">
              <div>
                <h1 className="view-title">Dashboard</h1>
                <p className="view-subtitle">Monitor your active learning metrics and stats</p>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper" style={{ color: '#ff6f00', borderColor: 'rgba(255,111,0,0.3)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                </div>
                <div className="stat-info">
                  <h3>{progress.studyStreak || 0} Days</h3>
                  <p>Current Study Streak</p>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                </div>
                <div className="stat-info">
                  <h3>{progress.totalDocuments || 0}</h3>
                  <p>PDF Documents Uploaded</p>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper" style={{ color: 'var(--primary-purple)', borderColor: 'rgba(134,39,255,0.3)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </div>
                <div className="stat-info">
                  <h3>{progress.totalNotes || 0}</h3>
                  <p>AI Summaries & Notes</p>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper" style={{ color: 'var(--success-green)', borderColor: 'rgba(16,185,129,0.3)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <div className="stat-info">
                  <h3>{progress.averageQuizScore || 0}%</h3>
                  <p>Average Quiz Score ({progress.totalQuizAttempts || 0} taken)</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
              <div className="glass-panel" style={{ minHeight: '350px' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '18px', marginBottom: '20px' }}>Progress Overviews</h3>
                
                <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'space-around', padding: '20px 0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                      <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="url(#purple-glow)" strokeWidth="8" 
                          strokeDasharray={2 * Math.PI * 50} 
                          strokeDashoffset={2 * Math.PI * 50 * (1 - (progress.totalFlashcards ? progress.flashcardsMastered / progress.totalFlashcards : 0))}
                          strokeLinecap="round"
                          transform="rotate(-90 60 60)"
                        />
                        <defs>
                          <linearGradient id="purple-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--primary-purple)" />
                            <stop offset="100%" stopColor="var(--primary-cyan)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '18px' }}>
                        {progress.totalFlashcards ? Math.round((progress.flashcardsMastered / progress.totalFlashcards) * 100) : 0}%
                      </div>
                    </div>
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-gray-300)' }}>Flashcards Mastered</p>
                    <span style={{ fontSize: '11px', color: 'var(--text-gray-500)' }}>{progress.flashcardsMastered} / {progress.totalFlashcards} cards</span>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                      <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--success-green)" strokeWidth="8" 
                          strokeDasharray={2 * Math.PI * 50} 
                          strokeDashoffset={2 * Math.PI * 50 * (1 - (progress.averageQuizScore / 100))}
                          strokeLinecap="round"
                          transform="rotate(-90 60 60)"
                        />
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '18px' }}>
                        {progress.averageQuizScore || 0}%
                      </div>
                    </div>
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-gray-300)' }}>Quiz Efficiency</p>
                    <span style={{ fontSize: '11px', color: 'var(--text-gray-500)' }}>{progress.totalQuizzes} interactive tests</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', maxHeight: '350px' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '18px', marginBottom: '16px' }}>Study Activity Logs</h3>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                  {progress.historyLog && progress.historyLog.length > 0 ? (
                    progress.historyLog.map((log, idx) => (
                      <div key={idx} style={{ padding: '10px 14px', background: 'var(--bg-dark)', border: '1px solid var(--border-muted)', borderRadius: '8px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-gray-500)', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--primary-purple)' }}>{log.action}</span>
                          <span>{log.date}</span>
                        </div>
                        <div style={{ color: 'var(--text-white)' }}>{log.details}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-gray-500)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                      No study history logged.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: PDF UPLOAD */}
        {currentView === 'documents' && (
          <div>
            <div className="view-header">
              <div>
                <h1 className="view-title">PDF Documents</h1>
                <p className="view-subtitle">Upload educational papers or textbooks to create customized AI studies</p>
              </div>
            </div>

            <div 
              className={`upload-container ${isDragging ? 'dragging' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <div className="upload-icon">
                {uploadLoading ? (
                  <span className="spinner" style={{ width: '48px', height: '48px' }}></span>
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                )}
              </div>
              
              {uploadLoading ? (
                <div>
                  <h3 style={{ marginBottom: '8px' }}>Parsing Document Text...</h3>
                  <p style={{ color: 'var(--text-gray-400)', fontSize: '13px' }}>Extracting semantic text fields using PDF buffer streams</p>
                </div>
              ) : (
                <div>
                  <h3 style={{ marginBottom: '8px' }}>Drag & Drop PDF or Browse</h3>
                  <p style={{ color: 'var(--text-gray-400)', fontSize: '13px', marginBottom: '16px' }}>Upload local PDF books, articles, or lecture slides up to 10MB</p>
                  <input 
                    type="file" 
                    id="file-browse" 
                    accept=".pdf" 
                    style={{ display: 'none' }} 
                    onChange={(e) => handleFileUpload(e.target.files[0])} 
                  />
                  <label htmlFor="file-browse" className="glass-btn glass-btn-primary">
                    Choose File
                  </label>
                </div>
              )}

              {uploadError && (
                <div style={{ color: 'var(--error-red)', marginTop: '16px', fontSize: '13px', fontWeight: 500 }}>
                  {uploadError}
                </div>
              )}
            </div>

            <h3 style={{ fontFamily: 'var(--font-title)', marginTop: '40px', marginBottom: '16px' }}>Uploaded Study Materials</h3>

            {documents.length > 0 ? (
              <div className="document-grid">
                {documents.map(doc => (
                  <div key={doc._id} className="glass-panel document-card" style={{ borderColor: selectedDocId === doc._id ? 'var(--primary-purple)' : 'var(--border-muted)' }}>
                    <div className="document-card-header">
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '24px', color: 'var(--primary-purple)' }}>📄</span>
                        <div>
                          <div className="document-title-text" title={doc.title}>{doc.title}</div>
                          <div className="document-meta">
                            {Math.round(doc.charCount / 1000)}k characters • {new Date(doc.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button 
                        className="glass-btn glass-btn-danger" 
                        style={{ padding: '6px', borderRadius: '8px' }}
                        onClick={(e) => deleteDocument(doc._id, e)}
                        title="Delete Document"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>

                    <div className="document-actions">
                      <button 
                        className="glass-btn" 
                        style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                        onClick={() => {
                          setSelectedDocId(doc._id);
                          setCurrentView('notes');
                        }}
                      >
                        Notes
                      </button>
                      <button 
                        className="glass-btn" 
                        style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                        onClick={() => {
                          setSelectedDocId(doc._id);
                          setCurrentView('quizzes');
                        }}
                      >
                        Quiz
                      </button>
                      <button 
                        className="glass-btn" 
                        style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                        onClick={() => {
                          setSelectedDocId(doc._id);
                          setCurrentView('flashcards');
                        }}
                      >
                        Cards
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-gray-400)' }}>
                No study documents uploaded yet. Upload a PDF above to begin.
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: NOTES */}
        {currentView === 'notes' && (
          <div>
            <div className="view-header">
              <div>
                <h1 className="view-title">AI Note Generator</h1>
                <p className="view-subtitle">Generate optimized academic reviews from your text context</p>
              </div>
              {selectedDocId && !notesLoading && (
                <button className="glass-btn glass-btn-primary" onClick={generateNotes}>
                  {currentNote ? 'Regenerate Notes' : 'Generate AI Notes'}
                </button>
              )}
            </div>

            {!selectedDocId ? (
              <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-gray-400)' }}>
                Please select a document in the sidebar to generate or view notes.
              </div>
            ) : notesLoading ? (
              <div className="glass-panel loader-container">
                <span className="spinner" style={{ width: '48px', height: '48px' }}></span>
                <h3>Synthesizing Academic Materials...</h3>
                <p>Generating headings, bold terms, summaries, and key review queries via Gemini LLM</p>
              </div>
            ) : currentNote ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>
                <div className="glass-panel" style={{ padding: '36px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                  {renderMarkdown(currentNote.contentMarkdown)}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="glass-panel">
                    <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '16px', marginBottom: '12px' }}>Document Details</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-gray-400)', marginBottom: '8px' }}>
                      <strong>Source:</strong> {getSelectedDocTitle()}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-gray-400)' }}>
                      <strong>Created:</strong> {new Date(currentNote.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="glass-panel">
                    <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '16px', marginBottom: '16px' }}>Notes Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button className="glass-btn" onClick={() => setCurrentView('quizzes')}>
                        Test Knowledge (Quiz)
                      </button>
                      <button className="glass-btn" onClick={() => setCurrentView('flashcards')}>
                        Review Flashcards
                      </button>
                      <button className="glass-btn" onClick={() => setCurrentView('chat')}>
                        Ask AI Tutor Questions
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '80px 24px', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '12px' }}>Generate Study Notes</h3>
                <p style={{ color: 'var(--text-gray-400)', fontSize: '14px', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
                  Unlock key topics and concepts from <strong>"{getSelectedDocTitle()}"</strong>. Our AI splits your document to synthesize summaries and definitions.
                </p>
                <button className="glass-btn glass-btn-primary" onClick={generateNotes}>
                  Start AI Notes Synthesis
                </button>
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: QUIZZES */}
        {currentView === 'quizzes' && (
          <div>
            <div className="view-header">
              <div>
                <h1 className="view-title">Interactive Quizzes</h1>
                <p className="view-subtitle">Validate your content retention with multiple-choice tests</p>
              </div>
              {selectedDocId && !activeQuiz && !quizLoading && (
                <button className="glass-btn glass-btn-primary" onClick={generateQuiz}>
                  Create New Quiz
                </button>
              )}
            </div>

            {!selectedDocId ? (
              <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-gray-400)' }}>
                Please select a document in the sidebar to view or generate quizzes.
              </div>
            ) : quizLoading ? (
              <div className="glass-panel loader-container">
                <span className="spinner" style={{ width: '48px', height: '48px' }}></span>
                <h3>Designing Multiple-Choice Questions...</h3>
                <p>Developing options, keys, and logical explanations using Gemini models</p>
              </div>
            ) : activeQuiz ? (
              <div className="glass-panel" style={{ maxWidth: '750px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-muted)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-gray-400)', fontWeight: 600 }}>
                    Question {currentQuestionIndex + 1} of {quizQuestions.length}
                  </span>
                  <button 
                    className="glass-btn" 
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setActiveQuiz(null)}
                  >
                    Cancel Quiz
                  </button>
                </div>

                <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '2px', marginBottom: '32px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary-purple)', width: `${((currentQuestionIndex) / quizQuestions.length) * 100}%`, transition: 'width 0.3s' }}></div>
                </div>

                <div className="quiz-question-card">
                  <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '18px', fontWeight: 600, lineHeight: 1.5, marginBottom: '24px' }}>
                    {quizQuestions[currentQuestionIndex]?.question}
                  </h2>

                  <div className="options-grid">
                    {quizQuestions[currentQuestionIndex]?.options.map((opt, oIdx) => {
                      const isSelected = quizAnswers[currentQuestionIndex] === oIdx;
                      const correctAns = quizQuestions[currentQuestionIndex].correctAnswerIndex;
                      
                      let btnClass = "option-btn";
                      if (quizSubmitted) {
                        if (oIdx === correctAns) btnClass += " correct";
                        else if (isSelected) btnClass += " wrong";
                      } else if (isSelected) {
                        btnClass += " selected";
                      }

                      return (
                        <button 
                          key={oIdx} 
                          className={btnClass}
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers(prev => ({ ...prev, [currentQuestionIndex]: oIdx }))}
                        >
                          <div className="option-indicator">
                            {String.fromCharCode(65 + oIdx)}
                          </div>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {quizSubmitted && (
                  <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-dark)', border: '1px solid var(--border-muted)', borderRadius: '12px', fontSize: '13px' }}>
                    <p style={{ color: 'var(--success-green)', fontWeight: 600, marginBottom: '6px' }}>Explanation:</p>
                    <p style={{ color: 'var(--text-gray-400)' }}>{quizQuestions[currentQuestionIndex]?.explanation}</p>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', borderTop: '1px solid var(--border-muted)', paddingTop: '20px' }}>
                  <button 
                    className="glass-btn"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => {
                      setCurrentQuestionIndex(prev => prev - 1);
                      if (quizSubmitted) setQuizSubmitted(true);
                    }}
                  >
                    Previous
                  </button>

                  {!quizSubmitted && currentQuestionIndex === quizQuestions.length - 1 ? (
                    <button 
                      className="glass-btn glass-btn-primary"
                      disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                      onClick={submitQuizAnswers}
                    >
                      Submit Quiz
                    </button>
                  ) : quizSubmitted && currentQuestionIndex === quizQuestions.length - 1 ? (
                    <button 
                      className="glass-btn glass-btn-primary"
                      onClick={() => {
                        setActiveQuiz(null);
                        setCurrentView('dashboard');
                      }}
                    >
                      Back to Dashboard
                    </button>
                  ) : (
                    <button 
                      className="glass-btn"
                      disabled={quizAnswers[currentQuestionIndex] === undefined}
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                    >
                      Next Question
                    </button>
                  )}
                </div>

                {quizSubmitted && (
                  <div style={{ marginTop: '24px', textAlign: 'center', padding: '12px', color: 'var(--primary-cyan)', fontWeight: 600 }}>
                    Final Score: {quizScore} / {quizQuestions.length} ({Math.round((quizScore / quizQuestions.length) * 100)}%)
                  </div>
                )}
              </div>
            ) : quizzes.length > 0 ? (
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', marginBottom: '16px' }}>Available Tests</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {quizzes.map(quiz => (
                    <div key={quiz._id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '150px' }}>
                      <div>
                        <h4 style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: '15px' }}>{quiz.title}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-gray-400)', marginTop: '8px' }}>
                          {quiz.questions.length} multiple-choice questions
                        </p>
                      </div>
                      <button 
                        className="glass-btn glass-btn-primary" 
                        style={{ marginTop: '16px', width: '100%' }}
                        onClick={() => startQuizTaker(quiz)}
                      >
                        Start Test
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '80px 24px', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '12px' }}>Generate a Quiz</h3>
                <p style={{ color: 'var(--text-gray-400)', fontSize: '14px', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
                  Verify your comprehension by generating a tailored quiz from <strong>"{getSelectedDocTitle()}"</strong>.
                </p>
                <button className="glass-btn glass-btn-primary" onClick={generateQuiz}>
                  Generate AI Quiz
                </button>
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: FLASHCARDS */}
        {currentView === 'flashcards' && (
          <div>
            <div className="view-header">
              <div>
                <h1 className="view-title">Active Recall Flashcards</h1>
                <p className="view-subtitle">Review term concepts and toggle flipped cards to memorize key material</p>
              </div>
            </div>

            {!selectedDocId ? (
              <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-gray-400)' }}>
                Please select a document in the sidebar to view or generate flashcards.
              </div>
            ) : flashcardLoading ? (
              <div className="glass-panel loader-container">
                <span className="spinner" style={{ width: '48px', height: '48px' }}></span>
                <h3>Drafting Active Recall Terms...</h3>
                <p>Generating terms and structured semantic definitions via Gemini</p>
              </div>
            ) : flashcardDeck && flashcardDeck.cards.length > 0 ? (
              <div className="flashcard-view-container">
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', color: 'var(--text-gray-400)', fontSize: '13px', marginBottom: '16px' }}>
                  <span>Card {flashcardIndex + 1} of {flashcardDeck.cards.length}</span>
                  <span>Mastery: {flashcardDeck.cards.filter(c => c.mastered).length} / {flashcardDeck.cards.length} learned</span>
                </div>

                <div 
                  className={`card-container ${flashcardFlipped ? 'flipped' : ''}`}
                  onClick={() => setFlashcardFlipped(prev => !prev)}
                >
                  <div className="card-inner">
                    <div className="card-front">
                      <span style={{ fontSize: '11px', color: 'var(--primary-cyan)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: '24px' }}>
                        Concept/Question
                      </span>
                      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', fontWeight: 600, lineHeight: 1.4 }}>
                        {flashcardDeck.cards[flashcardIndex]?.front}
                      </h2>
                      <span style={{ fontSize: '12px', color: 'var(--text-gray-500)', marginTop: '40px' }}>
                        Click card to flip
                      </span>
                    </div>
                    <div className="card-back">
                      <span style={{ fontSize: '11px', color: 'var(--primary-purple)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: '24px' }}>
                        Answer/Definition
                      </span>
                      <p style={{ fontSize: '15px', color: '#e0e6f0', lineHeight: 1.5 }}>
                        {flashcardDeck.cards[flashcardIndex]?.back}
                      </p>
                      <span style={{ fontSize: '12px', color: 'var(--text-gray-500)', marginTop: '40px' }}>
                        Mark your performance below:
                      </span>
                    </div>
                  </div>
                </div>

                {flashcardFlipped && (
                  <div className="flashcard-mastery-buttons">
                    <button 
                      className="glass-btn glass-btn-danger" 
                      style={{ flex: 1 }}
                      onClick={() => handleCardMastery(flashcardDeck.cards[flashcardIndex].id || flashcardDeck.cards[flashcardIndex]._id, false)}
                    >
                      Need Practice âŒ
                    </button>
                    <button 
                      className="glass-btn" 
                      style={{ flex: 1, borderColor: 'var(--success-green)', color: '#a3ffd0' }}
                      onClick={() => handleCardMastery(flashcardDeck.cards[flashcardIndex].id || flashcardDeck.cards[flashcardIndex]._id, true)}
                    >
                      Got It! âœ…
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '20px', width: '100%', marginTop: '32px' }}>
                  <button 
                    className="glass-btn" 
                    style={{ flex: 1 }}
                    disabled={flashcardIndex === 0}
                    onClick={() => {
                      setFlashcardFlipped(false);
                      setTimeout(() => setFlashcardIndex(prev => prev - 1), 200);
                    }}
                  >
                    Previous
                  </button>
                  <button 
                    className="glass-btn" 
                    style={{ flex: 1 }}
                    disabled={flashcardIndex === flashcardDeck.cards.length - 1}
                    onClick={() => {
                      setFlashcardFlipped(false);
                      setTimeout(() => setFlashcardIndex(prev => prev + 1), 200);
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '80px 24px', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '12px' }}>Create Study Cards</h3>
                <p style={{ color: 'var(--text-gray-400)', fontSize: '14px', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
                  Generate a deck of Active Recall flashcards directly from the text of <strong>"{getSelectedDocTitle()}"</strong>.
                </p>
                <button className="glass-btn glass-btn-primary" onClick={generateFlashcards}>
                  Generate Flashcards
                </button>
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: DOUBT SOLVING (AI CHAT TUTOR) */}
        {currentView === 'chat' && (
          <div>
            <div className="view-header" style={{ marginBottom: '16px' }}>
              <div>
                <h1 className="view-title">AI Doubt Solver</h1>
                <p className="view-subtitle">
                  Chat with <strong>QuantumTutor</strong> contextually configured for <em>{getSelectedDocTitle()}</em>
                </p>
              </div>
            </div>

            <div className="glass-panel chat-container">
              <div className="chat-messages-area">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-message ${msg.sender}`}>
                    <div style={{ overflowX: 'auto' }}>
                      {msg.sender === 'ai' ? renderMarkdown(msg.text) : msg.text}
                    </div>
                    <div className="chat-message-meta">{msg.timestamp}</div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="chat-message ai" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '12px 20px' }}>
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                    <span style={{ fontSize: '13px', color: 'var(--text-gray-400)' }}>Tutor is typing...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 0', borderTop: '1px solid var(--border-muted)' }}>
                <button 
                  className="glass-btn" 
                  style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', whiteSpace: 'nowrap' }}
                  onClick={() => setChatInput('Summarize the primary takeaways of this document.')}
                >
                  ðŸ“ Summarize document
                </button>
                <button 
                  className="glass-btn" 
                  style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', whiteSpace: 'nowrap' }}
                  onClick={() => setChatInput('Explain the most complex concept inside this text like I am 5.')}
                >
                  ðŸ‘¶ Explain like I am 5
                </button>
                <button 
                  className="glass-btn" 
                  style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', whiteSpace: 'nowrap' }}
                  onClick={() => setChatInput('Formulate 3 practical interview questions based on this topic.')}
                >
                  ðŸ’¼ Interview questions
                </button>
              </div>

              <form className="chat-input-bar" onSubmit={sendChatMessage}>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="Ask the AI Tutor a doubt or search document context..." 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <button type="submit" className="glass-btn glass-btn-primary" disabled={chatLoading || !chatInput.trim()}>
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
