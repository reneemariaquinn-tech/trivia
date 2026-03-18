'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { getCategories, getQuizzes, getQuestions } from '../admin/topics/actions';
import './feedbackSystem.css';
import { triggerCorrectFeedback, triggerWrongFeedback, setSoundEnabled } from './feedbackSystem';

// --- Types ---
type Category = {
  id: string;
  name: string;
  imageUrl: string;
  quizCount: number;
};

type Quiz = {
  id: string;
  title: string;
  imageUrl: string;
  questionCount: number;
};

type AnswerQuestion = {
  id: string;
  text: string;
  imageUrl: string;
  audioUrls?: { [key: string]: string };
  imageMeta?: { orientation?: 'landscape' | 'portrait'; photographer?: string };
  difficulty: string;
  gameType?: 'multi-answer' | 'reminiscing';
  answers: { text: string; isCorrect: boolean }[];
};

type WhoAmIQuestion = {
  id: string;
  text: string;
  imageUrl: string;
  audioUrls?: { [key: string]: string };
  imageMeta?: { orientation?: 'landscape' | 'portrait'; photographer?: string };
  difficulty: string;
  gameType: 'who-am-i';
  clues: [string, string, string];
  answer: string;
};

type Question = AnswerQuestion | WhoAmIQuestion;

declare global {
  interface Window {
    __TRIVIA_GAME_DATA__?: {
      quiz: Quiz;
      questions: Question[];
      settings?: any;
    };
  }
}

export default function GamePage() {
  // --- State ---
  const [view, setView] = useState<'CATEGORIES' | 'QUIZZES' | 'LEVELS' | 'GAME' | 'RESULT'>('CATEGORIES');
  const [isLoading, setIsLoading] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [gameMode, setGameMode] = useState<'guided' | 'quiet' | 'auto' | 'stealth'>('guided');
  
  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Selections
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('easy');
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number>(15);

  const audioRef = useRef<HTMLAudioElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hasSavedResult = useRef(false);

  // Game Loop
  const [gameQuestions, setGameQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [shuffledAnswers, setShuffledAnswers] = useState<{ text: string; isCorrect: boolean; originalIdx: number }[]>([]);
  const [answerState, setAnswerState] = useState<{ selectedIdx: number | null; isCorrect: boolean; locked: boolean }>({
    selectedIdx: null,
    isCorrect: false,
    locked: false
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [autoHighlight, setAutoHighlight] = useState(false);
  const autoSequenceRef = useRef<any[]>([]);

  // Who Am I state
  const [revealedClues, setRevealedClues] = useState<Set<number>>(new Set());
  const [isImageRevealed, setIsImageRevealed] = useState(false);

  // --- Derived State ---
  const currentQ = gameQuestions[currentIndex];

  // --- Actions ---
  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const data = await getCategories();
      setCategories(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    const handleResize = () => {
      if (shellRef.current) {
        const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
        shellRef.current.style.transform = `scale(${scale})`;
        shellRef.current.style.opacity = '1';
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    loadCategories();

    // Check for standalone data (S3 / Single File Mode)
    if (typeof window !== 'undefined' && window.__TRIVIA_GAME_DATA__) {
      const { quiz, questions } = window.__TRIVIA_GAME_DATA__;
      setSelectedQuiz(quiz);
      setQuestions(questions);
      setView('LEVELS');
      setIsLoading(false);
    } else {
      loadCategories();
    }
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Effect: Reset Image Load State ---
  useEffect(() => {
    setImageLoaded(false);
    setAutoHighlight(false);
    setRevealedClues(new Set());
    setIsImageRevealed(false);
    // Clear any pending auto sequence timeouts when changing questions
    autoSequenceRef.current.forEach(clearTimeout);
    autoSequenceRef.current = [];
  }, [currentIndex]);

  // --- Effect: Cleanup Auto Sequence on Unmount ---
  useEffect(() => {
    return () => {
      autoSequenceRef.current.forEach(clearTimeout);
    };
  }, []);

  // --- Effect: Trigger Animations on Answer ---
  useEffect(() => {
    if (answerState.locked && answerState.selectedIdx !== null) {
      if (gameMode === 'stealth') return; // No feedback in stealth mode

      const btn = document.getElementById(`btn-answer-${answerState.selectedIdx}`);
      if (btn) {
        if (answerState.isCorrect) {
          const animations = ['flip', 'confetti', 'pulse'] as const;
          triggerCorrectFeedback(btn, animations[Math.floor(Math.random() * animations.length)]);
        } else {
          triggerWrongFeedback(btn);
        }
      }
    }
  }, [answerState.locked, answerState.selectedIdx, answerState.isCorrect, gameMode]);

  // --- Effect: Sync Audio State ---
  useEffect(() => {
    setSoundEnabled(isAudioOn);
  }, [isAudioOn]);

  // --- Effect: Force Audio On in Auto Mode ---
  useEffect(() => {
    if (gameMode === 'auto') {
      setIsAudioOn(true);
    }
  }, [gameMode]);

  // --- Effect: Save Score on Game End ---
  useEffect(() => {
    if (view === 'RESULT' && selectedQuiz && !hasSavedResult.current) {
      hasSavedResult.current = true;
      try {
        const history = JSON.parse(localStorage.getItem('trivia_history') || '[]');
        history.push({
          quizId: selectedQuiz.id,
          score: score,
          total: gameQuestions.length,
          date: new Date().toISOString()
        });
        localStorage.setItem('trivia_history', JSON.stringify(history));
      } catch (e) {
        console.warn("Failed to save game history", e);
      }
    }
  }, [view, selectedQuiz, score, gameQuestions.length]);

  // --- Effect: Preload Next Question Assets ---
  useEffect(() => {
    if (view === 'GAME' && currentIndex < gameQuestions.length - 1) {
      const nextQ = gameQuestions[currentIndex + 1];
      if (nextQ) {
        // Preload Image
        if (nextQ.imageUrl) {
          const img = new Image();
          img.src = nextQ.imageUrl;
        }
        // Preload Audio
        if (nextQ.audioUrls?.en) {
          const audio = new Audio();
          audio.src = nextQ.audioUrls.en;
          audio.load();
        }
      }
    }
  }, [view, currentIndex, gameQuestions]);

  const selectCategory = async (cat: Category) => {
    setSelectedCategory(cat);
    setIsLoading(true);
    try {
      const data = await getQuizzes(cat.id);
      const sortedQuizzes = data.quizzes.sort((a: Quiz, b: Quiz) => a.title.localeCompare(b.title));
      setQuizzes(sortedQuizzes);
      setView('QUIZZES');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectQuiz = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setIsLoading(true);
    try {
      const { questions } = await getQuestions(quiz.id);
      setQuestions(questions as any);
      setSelectedLevel('easy');
      setView('LEVELS');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectLevel = (level: string) => {
    setSelectedLevel(level);
  };

  const startGame = () => {
    // Filter by level; if not enough to fill the requested count, use the full pool
    const byLevel = questions.filter(q => (q.difficulty || 'medium') === selectedLevel);
    const pool = [...(byLevel.length >= selectedQuestionCount ? byLevel : questions)];

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Take exactly the requested count, or all available if fewer exist
    const shuffled = pool.slice(0, selectedQuestionCount);
    
    if (shuffled.length === 0) {
      alert("No questions found for this quiz/level.");
      return;
    }

    hasSavedResult.current = false;
    setGameQuestions(shuffled);
    setScore(0);
    setCurrentIndex(0);
    loadQuestion(shuffled[0]);
    setView('GAME');
  };

  const loadQuestion = (q: Question) => {
    if ('clues' in q) {
      // who-am-i: clues are displayed as progressive reveal buttons, not selectable answers
      const answers = q.clues.map((text, i) => ({ text, isCorrect: false, originalIdx: i }));
      setShuffledAnswers(answers);
    } else {
      // multi-answer / reminiscing: do not shuffle so order matches generated audio
      const answers = q.answers.map((a, i) => ({ ...a, originalIdx: i }));
      setShuffledAnswers(answers);
    }
    setAnswerState({ selectedIdx: null, isCorrect: false, locked: false });
    setRevealedClues(new Set());
    setIsImageRevealed(false);
  };

  const handleRevealAnswer = () => {
    setIsImageRevealed(true);
    setRevealedClues(new Set([0, 1, 2]));
    triggerCorrectFeedback(document.getElementById('btn-reveal') as HTMLElement, 'pulse');
  };

  const handleNext = () => {
    if (currentIndex < gameQuestions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      loadQuestion(gameQuestions[nextIdx]);
    } else {
      setView('RESULT');
    }
  };

  const handleAnswer = (idx: number, isCorrect: boolean) => {
    if (gameMode === 'stealth') return;
    if (answerState.locked) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const newScore = isCorrect ? score + 1 : score;
    setScore(newScore);
    setAnswerState({ selectedIdx: idx, isCorrect, locked: true });
  };

  const handleRestart = () => {
    setView('CATEGORIES');
    setSelectedCategory(null);
    setSelectedQuiz(null);
    setQuestions([]);
  };

  const handleBack = () => {
    switch (view) {
      case 'QUIZZES':
        setView('CATEGORIES');
        setSelectedCategory(null);
        break;
      case 'LEVELS':
        setView('QUIZZES');
        setSelectedQuiz(null);
        break;
      case 'RESULT':
        setView('QUIZZES');
        setGameQuestions([]);
        setSelectedQuiz(null);
        break;
    }
  };

  // --- Render Helpers ---
  const isLandscape = currentQ?.imageMeta?.orientation !== 'portrait'; // Default to landscape

  // --- Auto Mode Sequence ---
  const runAutoSequence = () => {
    if (gameMode !== 'auto') return;
    if (currentQ?.gameType === 'who-am-i') return; // Auto mode not applicable for who-am-i
    
    // Clear any existing timeouts to prevent overlaps
    autoSequenceRef.current.forEach(clearTimeout);
    autoSequenceRef.current = [];

    // 1. Audio finished (or skipped).
    // 1.5s pause
    const t1 = setTimeout(() => {
      // 2. Highlight
      setAutoHighlight(true);

      // 1.5s pause
      const t2 = setTimeout(() => {
        // 3. Reveal
        const correctIdx = shuffledAnswers.findIndex(a => a.isCorrect);
        if (correctIdx !== -1) {
          setAnswerState({ selectedIdx: correctIdx, isCorrect: true, locked: true });
        }

        // 1.5s pause
        const t3 = setTimeout(() => {
          // 4. Next
          handleNext();
        }, 1500);
        autoSequenceRef.current.push(t3);

      }, 1500);
      autoSequenceRef.current.push(t2);

    }, 1500);
    autoSequenceRef.current.push(t1);
  };

  return (
    <div className="game-root">
      {/* -- Google tag (gtag.js) -- */}
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-3FSLPG9C9P"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-3FSLPG9C9P');
        `}
      </Script>
      {/* External Resources */}
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />

      <div id="shell" ref={shellRef} className={view === 'GAME' ? 'view-game' : ''}>

        {/* --- VIEW: CATEGORIES --- */}
        {view === 'CATEGORIES' && (
          <section className="menu-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h1 className="menu-title" style={{ marginBottom: 0 }}>Play Trivia</h1>
            </div>
            {isLoading ? <div className="loader">Loading...</div> : (
              <div className="card-grid">
                {categories.map(cat => (
                  <div key={cat.id} className="menu-card" onClick={() => selectCategory(cat)}>
                    <div className="card-img-wrap">
                      {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.name} /> : <div className="no-img">📚</div>}
                    </div>
                    <div className="card-label">{cat.name}</div>
                    <div className="card-meta">{cat.quizCount} Quizzes</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* --- VIEW: QUIZZES --- */}
        {view === 'QUIZZES' && (
          <section className="menu-view">
            <div className="view-header">
              <button className="nav-back" onClick={handleBack}>
                <span className="material-icons-round">arrow_back</span>
                <span>Back</span>
              </button>
              <h1 className="menu-title" style={{ marginBottom: 0 }}>{selectedCategory?.name}</h1>
            </div>
            {isLoading ? <div className="loader">Loading...</div> : (
              <div className="card-grid">
                {quizzes.map(quiz => (
                  <div key={quiz.id} className="menu-card" onClick={() => selectQuiz(quiz)}>
                    <div className="card-img-wrap">
                      {quiz.imageUrl ? <img src={quiz.imageUrl} alt={quiz.title} /> : <div className="no-img">📝</div>}
                    </div>
                    <div className="card-label">{quiz.title}</div>
                  </div>
                ))}
                {quizzes.length === 0 && <div className="empty-msg">No quizzes found.</div>}
              </div>
            )}
          </section>
        )}

        {/* --- VIEW: LEVELS --- */}
        {view === 'LEVELS' && (
          <section className="menu-view centered level-view-container">
            <div className="lobby-card overlay-card">
              <div className="lobby-left">
                {selectedQuiz?.imageUrl && <img src={selectedQuiz.imageUrl} alt="Cover" />}
              </div>
              
              <div className="lobby-right">
                <div style={{ width: '100%', display: 'flex', marginBottom: 10 }}>
                  <button className="nav-back" onClick={handleBack}>
                    <span className="material-icons-round">arrow_back</span>
                    <span>Back</span>
                  </button>
                </div>
                <h1 className="menu-title" style={{ marginTop: 0 }}>{selectedQuiz?.title}</h1>
                
                <div className="setting-row" style={{ display: 'none' }}>
                  <span className="setting-label">Level</span>
                  <div className="mode-selector">
                    {['easy', 'medium', 'hard'].map(level => {
                      const count = questions.filter(q => (q.difficulty || 'medium') === level).length;
                      const isDisabled = count < 5;
                      return (
                        <button
                          key={level}
                          className={`mode-opt ${selectedLevel === level ? 'active' : ''}`}
                          onClick={() => selectLevel(level)}
                          disabled={isDisabled}
                          style={{ opacity: isDisabled ? 0.3 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                        >
                          {level.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="setting-row">
                  <span className="setting-label">Game Type</span>
                  <div className="mode-selector">
                    <button
                      className={`mode-opt ${gameMode === 'guided' ? 'active' : ''}`}
                      onClick={() => { setGameMode('guided'); setIsAudioOn(true); }}
                    >
                      Guided
                    </button>
                    <button
                      className={`mode-opt ${gameMode === 'quiet' ? 'active' : ''}`}
                      onClick={() => { setGameMode('quiet'); setIsAudioOn(false); }}
                    >
                      Quiet
                    </button>
                    <button 
                      className={`mode-opt ${gameMode === 'auto' ? 'active' : ''}`}
                      onClick={() => { setGameMode('auto'); setIsAudioOn(true); }}
                    >
                      Auto
                    </button>
                  </div>
                </div>

                <div className="setting-row">
                  <span className="setting-label">Questions</span>
                  <div className="mode-selector">
                    {[15, 30, 50].map(count => (
                      <button
                        key={count}
                        className={`mode-opt ${selectedQuestionCount === count ? 'active' : ''}`}
                        onClick={() => setSelectedQuestionCount(count)}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mode-desc">
                  {gameMode === 'guided' && "Questions and audio guide you. Tap to move forward."}
                  {gameMode === 'quiet' && "You read the questions. Tap to move forward."}
                  {gameMode === 'auto' && "Runs automatically for relaxed viewing."}
                </div>

                <button className="level-btn primary" onClick={startGame} style={{ marginTop: 20, width: '100%' }}>
                  Start Game
                </button>
              </div>
            </div>
          </section>
        )}

        {/* --- VIEW: GAME --- */}
        {view === 'GAME' && currentQ && (
          <>
            {/* Audio Player - Auto plays when question loads. TODO: Use selected language */}
            {currentQ.audioUrls?.en && (
              <audio 
                ref={audioRef}
                key={currentQ.id} 
                src={currentQ.audioUrls.en} 
                autoPlay 
                muted={!isAudioOn}
                onEnded={runAutoSequence}
                style={{ display: 'none' }} 
              />
            )}
            <section id="content" className={isLandscape ? 'landscape' : 'portrait'}>
              {/* Image */}
              <div id="image-card">
                {/* Active Question Image */}
                {currentQ.imageUrl && (
                  <>
                    <img
                      id="trivia-img"
                      key={currentQ.id}
                      src={currentQ.imageUrl}
                      alt="Trivia image"
                      onLoad={() => setImageLoaded(true)}
                      style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        opacity: imageLoaded ? 1 : 0,
                        zIndex: 1,
                        filter: currentQ.gameType === 'who-am-i' && !isImageRevealed
                          ? 'blur(18px) brightness(0.55)'
                          : 'none',
                        transition: 'filter 0.6s ease, opacity 0.4s ease',
                      }}
                    />
                    {/* Who Am I: answer reveal overlay */}
                    {currentQ.gameType === 'who-am-i' && isImageRevealed && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
                        padding: '32px 20px 20px',
                        zIndex: 2, textAlign: 'center',
                      }}>
                        <span style={{ color: 'var(--teal)', fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.2 }}>
                          {currentQ.answer}
                        </span>
                      </div>
                    )}
                    {imageLoaded && currentQ.imageMeta?.photographer && (
                      <div className="photo-credit">
                        Photo: {currentQ.imageMeta.photographer}
                      </div>
                    )}
                  </>
                )}
                
                {/* Fallback Text */}
                {!currentQ.imageUrl && (
                  <div className="no-game-img" style={{ position: 'relative', zIndex: 1 }}>Trivia Time</div>
                )}
              </div>

              {/* Panel */}
              <div id="panel">
                <div id="q-block">
                  <p id="q-text">{currentQ.text}</p>
                </div>

                <div id="answers">
                  {currentQ.gameType === 'who-am-i' ? (
                    // Who Am I: clue reveal buttons
                    shuffledAnswers.map((ans, idx) => {
                      const isRevealed = revealedClues.has(idx);
                      return (
                        <button
                          key={idx}
                          id={`btn-answer-${idx}`}
                          className="ans"
                          onClick={() => setRevealedClues(prev => new Set([...prev, idx]))}
                          disabled={isRevealed}
                          style={{ opacity: isRevealed ? 1 : undefined }}
                        >
                          <div className="badge" style={isRevealed ? { background: 'rgba(102,224,224,0.15)', borderColor: 'var(--teal)', color: 'var(--teal)' } : {}}>
                            {idx + 1}
                          </div>
                          <div className="ans-label" style={{ color: isRevealed ? 'var(--white)' : 'rgba(255,255,255,0.35)', fontStyle: isRevealed ? 'normal' : 'italic' }}>
                            {isRevealed ? ans.text : `Clue ${idx + 1} — tap to reveal`}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    // Multi-answer / Reminiscing: standard answer buttons
                    shuffledAnswers.map((ans, idx) => {
                      const isSelected = answerState.selectedIdx === idx;
                      const showResult = answerState.locked && gameMode !== 'stealth';

                      let statusClass = '';
                      let badgeContent: React.ReactNode = String.fromCharCode(65 + idx);
                      let labelText: React.ReactNode = ans.text;

                      if (showResult) {
                        if (ans.isCorrect) {
                          statusClass = answerState.isCorrect ? 'correct' : 'correct-revealed';
                          badgeContent = <span className="material-icons-round">check</span>;
                        } else if (isSelected) {
                          statusClass = 'wrong-selected';
                          badgeContent = <span className="material-icons-round">close</span>;
                          labelText = <><span style={{ color: 'white' }}>Nice Try!</span> {ans.text}</>;
                        } else {
                          statusClass = 'wrong';
                        }
                      }

                      if (answerState.locked && gameMode === 'stealth' && isSelected) {
                        statusClass = 'selected-stealth';
                      }

                      return (
                        <button
                          key={idx}
                          id={`btn-answer-${idx}`}
                          className={`ans ${statusClass} ${answerState.locked ? 'locked' : ''} ${autoHighlight ? 'auto-highlight' : ''}`}
                          onClick={() => handleAnswer(idx, ans.isCorrect)}
                          disabled={gameMode === 'stealth' || gameMode === 'auto'}
                        >
                          <div className="badge">{badgeContent}</div>
                          <div className="ans-label">{labelText}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {/* Bottom Bar */}
            <footer id="bottombar">
              <div className="bar-info">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33.14 24.55" width="33" height="24" style={{ color: 'var(--teal)', height: '24px', width: 'auto' }}>
                  <path id="sparkle" fill="#66e0e0" d="M6.04,12.08l-.91-1.67c-.8-1.46-1.99-2.66-3.46-3.46l-1.67-.91,1.67-.91c1.46-.8,2.66-1.99,3.46-3.46l.91-1.67,.91,1.67c.8,1.46,1.99,2.66,3.46,3.46l1.67,.91-1.67,.91c-1.46,.8-2.66,1.99-3.46,3.46l-.91,1.67ZM3.55,6.04c.97,.68,1.81,1.53,2.49,2.49,.68-.97,1.53-1.81,2.49-2.49-.97-.68-1.81-1.53-2.49-2.49-.68,.97-1.53,1.81-2.49,2.49Z" />
                  <g id="text" fill="white">
                    <path d="M16.77,8.35c-.32-.04-.64-.07-.97-.07-4.2,0-7.61,3.41-7.61,7.61v8.32h2.62V15.89c0-2.76,2.24-5,5-5,.33,0,.66,.03,.97,.1v-2.64Z" />
                    <path d="M19.96,17.34c.4,2.9,2.74,4.67,6.28,4.67,2.3,0,4.31-.73,5.78-2.14h.13v2.87c-1.4,1.14-3.54,1.8-5.98,1.8-5.51,0-9.08-3.24-9.08-8.15s3.37-8.15,8.15-8.15,7.91,2.97,7.91,7.51v1.57h-13.19Zm0-2.37h10.55c-.4-2.54-2.4-4.17-5.24-4.17-2.67,0-4.77,1.67-5.31,4.17Z" />
                  </g>
                </svg>
                <div className="bar-sep"></div>
                <div className="bar-item lit">
                  <span className="material-icons-round">list_alt</span>
                  <span id="q-counter">{currentIndex + 1} / {gameQuestions.length}</span>
                </div>

                {gameMode !== 'stealth' && (
                  <>
                    <div className="bar-sep"></div>
                    <div className="bar-item lit">
                      <span className="material-icons-round">star</span>
                      <span id="score-val">Score: {score}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="bar-tools">
                {isAudioOn && (
                  <button 
                    className="action-btn outline" 
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch(e => console.error(e));
                      }
                    }}
                    disabled={!currentQ.audioUrls?.en}
                    style={{ opacity: currentQ.audioUrls?.en ? 1 : 0.3 }}
                  >
                    <span className="material-icons-round">replay</span>
                    <span>Replay</span>
                  </button>
                )}

                {currentQ.gameType === 'who-am-i' && !isImageRevealed && (
                  <button id="btn-reveal" className="action-btn primary" onClick={handleRevealAnswer}>
                    <span className="material-icons-round">visibility</span>
                    <span>Reveal</span>
                  </button>
                )}

                {gameMode !== 'auto' && (currentQ.gameType !== 'who-am-i' || isImageRevealed) && (
                  <button className="action-btn primary" onClick={handleNext}>
                    <span>Next</span>
                    <span className="material-icons-round" style={{ fontSize: '1.2em' }}>arrow_forward</span>
                  </button>
                )}
              </div>
            </footer>
          </>
        )}

        {/* --- VIEW: RESULT --- */}
        {view === 'RESULT' && (
          <section className="menu-view centered">
            <div className="result-back-overlay">
              <button className="nav-back" onClick={handleBack}>
                <span className="material-icons-round">arrow_back</span>
                <span>Back</span>
              </button>
            </div>
            {gameMode === 'stealth' ? (
              <div className="stealth-results-card">
                <h1 className="menu-title">Answers</h1>
                <div className="stealth-grid">
                  {Array.from({ length: Math.ceil(gameQuestions.length / 5) }).map((_, groupIdx) => (
                    <div key={groupIdx} className="stealth-group">
                      <h3 className="group-title">Questions {groupIdx * 5 + 1} - {Math.min((groupIdx + 1) * 5, gameQuestions.length)}</h3>
                      {gameQuestions.slice(groupIdx * 5, (groupIdx + 1) * 5).map((q, i) => {
                        const globalNum = groupIdx * 5 + i + 1;
                        const correct = 'answers' in q ? q.answers.find(a => a.isCorrect) : null;
                        const revealText = 'answer' in q ? q.answer : correct?.text;
                        return (
                          <div key={q.id} className="stealth-item">
                            <span className="s-num">{globalNum}.</span>
                            <div className="s-content">
                              <div className="s-q">{q.text}</div>
                              <div className="s-a">{revealText}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <button className="level-btn primary" onClick={handleRestart} style={{ marginTop: 30 }}>Play Again</button>
              </div>
            ) : gameMode === 'auto' ? (
              <div className="result-card">
                <div className="result-icon">✨</div>
                <h1 className="menu-title">Game Over</h1>
                <p className="result-msg">
                  I hope you got everything right!
                </p>
                <button className="level-btn primary" onClick={handleRestart}>Play Again</button>
              </div>
            ) : (
              <div className="result-card">
                <div className="result-icon">🏆</div>
                <h1 className="menu-title">Quiz Complete!</h1>
                <div className="final-score">
                  <span className="score-big">{score}</span>
                  <span className="score-total">/ {gameQuestions.length}</span>
                </div>
                <p className="result-msg">
                  {score === gameQuestions.length ? "Perfect Score!" : 
                   score > gameQuestions.length / 2 ? "Great Job!" : "Nice Try!"}
                </p>
                <button className="level-btn primary" onClick={handleRestart}>Play Again</button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* STYLES FROM TEMPLATE + ADAPTATIONS */}
      <style jsx global>{`
        /* ─── Reset ─── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --black:  #000000;
          --white:  #ffffff;
          --teal:   #66e0e0;
          --grey:   #1e1e1e;
          --grey2:  #2c2c2c;
          --dim:    rgba(255,255,255,0.35);
        }

        .game-root {
          width: 100vw;
          height: 100vh;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        /* ═══════════════════════════════════════
           SHELL  ─  1280x720 Fixed Aspect Ratio
        ═══════════════════════════════════════ */
        #shell {
          width: 1280px;
          height: 720px;
          display: grid;
          grid-template-rows: 1fr;
          background: var(--black);
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          color: var(--white);
          overflow: hidden;
          box-shadow: 0 0 50px rgba(0,0,0,0.5);
          /* Scale to fit viewport */
          transform-origin: center center;
          opacity: 0; /* Hidden until JS calculates scale */
          transition: opacity 0.2s;
        }
        #shell.view-game {
          grid-template-rows: 1fr 6rem;
        }
        .nav-back {
          background: transparent;
          border: 1px solid #333;
          color: #888;
          padding: 8px 16px;
          border-radius: 99px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: inherit;
          font-weight: 600;
          transition: all 0.2s;
        }
        .nav-back:hover {
          border-color: var(--teal);
          color: var(--teal);
        }
        .nav-icon-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: color 0.2s;
        }
        .nav-icon-btn:hover { color: var(--white); }

        /* ── Menus (Categories/Quizzes) ── */
        .menu-view {
          padding: 20px 40px;
          overflow-y: auto;
          background: var(--black);
        }
        .menu-view.centered {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .menu-title {
          font-size: 2rem;
          margin-bottom: 24px;
          color: var(--white);
        }
        .card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 24px;
          padding-bottom: 40px;
        }
        .menu-card {
          background: var(--grey);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          position: relative;
          text-align: center;
          /* Pre-set a transparent border to prevent "jumping" when hovering */
          border: 5px dotted transparent;
          transition: border-color 0.3s ease; /* Makes the spots fade in smoothly */
        }
        .menu-card:hover {
          border-color: #66e0e0;
        }
        .card-img-wrap {
          height: 140px;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card-img-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .no-img { font-size: 3rem; opacity: 0.5; }
        .card-label {
          padding: 16px 8px;
          font-size: 1.5rem;
          font-weight: 700;
        }
        .card-meta {
          padding: 0 16px 16px;
          font-size: 0.8rem;
          color: #888;
        }

        /* ── Level Selection ── */
        .level-card {
          text-align: left;
          width: 900px;
          max-width: 90vw;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          background: var(--grey);
          padding: 40px;
          border-radius: 24px;
          align-items: center;
        }
        .level-img {
          width: 100%; 
          aspect-ratio: 4/3;
          border-radius: 20px;
          overflow: hidden;
          background: #222;
        }
        .level-img img { width: 100%; height: 100%; object-fit: cover; }
        .menu-subtitle { color: #888; margin-bottom: 30px; }
        .level-buttons { display: flex; flex-direction: column; gap: 12px; }
        .level-btn {
          background: var(--grey);
          background: #2c2c2c; /* Slightly lighter than card bg */
          color: var(--white);
          border: none;
          padding: 16px;
          border-radius: 12px;
          font-family: inherit;
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .level-btn:hover { background: var(--teal); color: var(--black); }
        .level-btn.primary { background: var(--teal); color: var(--black); }

        .view-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        /* ── Results ── */
        .result-card { text-align: center; }
        .result-icon { font-size: 5rem; margin-bottom: 10px; }
        .final-score { margin: 20px 0; }
        .score-big { font-size: 5rem; color: var(--teal); line-height: 1; }
        .score-total { font-size: 2rem; color: #666; }
        .result-msg { font-size: 1.5rem; color: #aaa; margin-bottom: 40px; }
        .result-back-overlay {
          position: absolute;
          top: 20px;
          left: 40px;
          z-index: 10;
        }

        /* ─────────────────────────────────────
           GAME CONTENT AREA
        ───────────────────────────────────── */
        #content {
          padding: 14px 20px;
          display: grid;
          gap: 16px;
          background: var(--black);
          min-height: 0;
          position: relative;
        }
        #content.landscape {
          grid-template-columns: 58fr 42fr;
          grid-template-rows: 1fr;
          grid-template-areas: "img panel";
        }
        #content.portrait {
          grid-template-columns: 38fr 62fr;
          grid-template-rows: 1fr;
          grid-template-areas: "img panel";
        }

        #image-card {
          grid-area: img;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          border-radius: 14px;
          overflow: hidden;
          position: relative;
          background: #0a0a0a;
        }
        #trivia-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transition: opacity .4s ease;
        }
        .photo-credit {
          position: absolute;
          bottom: 12px;
          left: 12px;
          background: var(--white);
          color: var(--black);
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 6px;
          pointer-events: none;
          z-index: 5;
        }
        .no-game-img {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: #333; font-size: 2rem; font-weight: 800;
        }

        #panel {
          grid-area: panel;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
          min-height: 0;
          height: 100%;
        }
        #q-block { flex-shrink: 0; padding-bottom: 4px; }
        #q-text {
          font-size: 2rem;
          font-weight: 600;
          color: var(--white);
          line-height: 1.35;
          padding:16px 0 16px 0;
        }

        #answers {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-height: 0;
        }
        .ans {
          display: flex;
          align-items: center;
          gap: 14px;
          border: none;
          border-radius: 12px;
          padding: 0 18px;
          cursor: pointer;
          text-align: left;
          position: relative;
          overflow: hidden;
          flex: 1;
          min-height: 0;
          background: var(--grey);
          box-shadow: 0 4px 0 rgba(0,0,0,0.6);
          transition: transform .1s ease, background .12s ease, box-shadow .1s ease;
          color: var(--white);
          font-family: inherit;
        }
        .ans:hover {
          background: var(--grey2);
          transform: translateY(-2px);
          box-shadow: 0 6px 0 rgba(0,0,0,0.6);
        }
        .ans:active {
          transform: translateY(2px);
          box-shadow: 0 1px 0 rgba(0,0,0,0.6);
        }

        .badge {
          flex-shrink: 0;
          width: 54px;
          height: 54px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: 2px solid rgba(255,255,255,0.14);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.7rem;
          font-weight: 700;
          color: rgba(255,255,255,0.5);
        }
        .ans-label {
          font-size: 2rem;
          font-weight: 600;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* States */
        .ans.correct {
          background: #66e0e0;
          box-shadow: 0 4px 0 rgba(0,0,0,0.5);
          color: var(--black);
        }
        .ans.correct .badge {
          background: rgba(0,0,0,0.18);
          border-color: rgba(0,0,0,0.25);
          color: var(--black);
        }
        
        /* Correct Answer Revealed (when user picked wrong) */
        .ans.correct-revealed {
          border: 3px solid #66e0e0;
          background: var(--grey);
          color: #66e0e0;
          box-shadow: 0 4px 0 rgba(0,0,0,0.5);
        }
        .ans.correct-revealed .badge {
          border-color: #66e0e0;
          color: #66e0e0;
          background: rgba(102, 224, 224, 0.1);
        }

        /* Selected Wrong Answer */
        .ans.wrong-selected {
          border: 2px solid #D58A94;
          background: var(--grey);
          color: #D58A94;
          box-shadow: 0 4px 0 rgba(0,0,0,0.5);
        }
        .ans.wrong-selected .badge {
          border-color: #D58A94;
          color: #D58A94;
          background: rgba(255, 107, 107, 0.1);
        }

        .ans.wrong {
          background: rgba(255,255,255,0.04);
          box-shadow: 0 4px 0 rgba(0,0,0,0.3);
          opacity: .32;
        }
        .ans.locked { pointer-events: none; }
        .ans.selected-stealth { background: var(--white); color: var(--black); box-shadow: 0 4px 0 rgba(255,255,255,0.5); }
        .ans:disabled { cursor: default; opacity: 1; }
        .ans:disabled:hover { transform: none; background: var(--grey); box-shadow: 0 4px 0 rgba(0,0,0,0.6); }

        .ans.auto-highlight {
          border: 2px solid #66e0e0;
          box-shadow: 0 0 15px rgba(102, 224, 224, 0.4);
        }

        @keyframes pop {
          0%   { transform: scale(1); }
          45%  { transform: scale(1.03); }
          100% { transform: scale(1); }
        }

        /* ── Bottom Bar ── */
        #bottombar {
          background: #0a0a0a;
          border-top: 1px solid #1e1e1e;
          display: flex;
          align-items: center;
          padding: 0 24px;
          justify-content: space-between;
          gap: 16px;
          height: 6rem;
        }
        .bar-info {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .bar-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 1.5rem;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
          white-space: nowrap;
        }
        .bar-item .material-icons-round {
          font-size: 1.1rem;
          color: var(--teal);
        }
        .bar-item.lit { color: var(--white); }
        .bar-sep { width: 1px; height: 40px; background: #2a2a2a; flex-shrink: 0; }
        .bar-tools { display: flex; align-items: center; gap: 16px; }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 12px;
          font-family: inherit;
          font-weight: 700;
          font-size: 1.2rem;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .action-btn.primary {
          background: var(--teal);
          color: var(--black);
          border-color: var(--teal);
        }
        .action-btn.primary:hover {
          background: #5cdcdc;
          border-color: #5cdcdc;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 224, 224, 0.3);
        }
        .action-btn.primary:active { transform: translateY(0); }

        .action-btn.outline {
          background: transparent;
          border: 2px var(--white) transparent;
          color: var(--white);
          
        }
        .action-btn.outline:hover {
          background: rgba(102, 224, 224, 0.1);
          transform: translateY(-2px);
        }
        .action-btn.outline:active { transform: translateY(0); }
        .action-btn.outline:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          border-color: #444;
          color: #666;
          transform: none;
        }

        .loader { color: #666; font-size: 1.5rem; text-align: center; margin-top: 50px; }
        .empty-msg { color: #666; text-align: center; margin-top: 50px; width: 100%; grid-column: 1/-1; }

        /* Lobby Styles */
        .level-view-container {
          position: relative;
          overflow: hidden;
        }
        .overlay-card {
          position: relative;
          z-index: 1;
          background: rgba(30, 30, 30, 0.9) !important;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .lobby-card {
          background: var(--grey);
          padding: 0;
          border-radius: 24px;
          width: 1024px;
          max-width: 90vw;
          display: flex;
          overflow: hidden;
        }
        .lobby-left {
          width: 50%;
          background: #111;
          position: relative;
        }
        .lobby-left img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .lobby-right {
          flex: 1;
          padding: 40px;
          display: flex; flex-direction: column; justify-content: center;
        }
        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .setting-label { font-size: 1.2rem; font-weight: 600; color: #ccc; }
        
        .toggle-btn {
          width: 60px; height: 32px;
          border-radius: 99px;
          border: none;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
        }
        .toggle-btn.on { background: var(--white); }
        .toggle-btn.off { background: #333; }
        .toggle-thumb {
          width: 24px; height: 24px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 4px;
          left: 4px;
          transition: transform 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .toggle-btn.on .toggle-thumb { background: var(--black); transform: translateX(28px); }

        .mode-selector { display: flex; gap: 8px; background: #111; padding: 4px; border-radius: 12px; }
        .mode-opt { flex: 1; background: transparent; border: none; color: #888; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .mode-opt.active { background: var(--white); color: var(--black); box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2); }
        
        .mode-desc { margin-top: -10px; margin-bottom: 20px; font-size: 0.9rem; color: #666; min-height: 1.4em; }

        /* Stealth Results */
        .stealth-results-card {
          width: 1000px;
          max-width: 95vw;
          background: var(--grey);
          border-radius: 24px;
          padding: 40px;
          max-height: 85vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stealth-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
          width: 100%;
        }
        .stealth-group {
          background: rgba(0,0,0,0.2);
          padding: 20px;
          border-radius: 16px;
        }
        .group-title {
          color: var(--teal);
          margin-bottom: 16px;
          font-size: 1.1rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 8px;
        }
        .stealth-item { display: flex; gap: 12px; margin-bottom: 12px; font-size: 0.9rem; text-align: left; }
        .s-num { color: #888; font-weight: 700; min-width: 24px; }
        .s-content { flex: 1; }
        .s-q { color: #ccc; margin-bottom: 4px; }
        .s-a { color: var(--white); font-weight: 700; }

        .loading-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: var(--black);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          z-index: 100; gap: 20px;
        }
        .spinner {
          width: 40px; height: 40px;
          border: 4px solid rgba(255,255,255,0.1);
          border-left-color: var(--teal);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}