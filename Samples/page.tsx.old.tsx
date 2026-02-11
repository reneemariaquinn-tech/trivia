'use client';

import { useState, useEffect } from 'react';
import { getCategories, getQuizzes, getQuestions } from '../admin/topics/actions';

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

type Question = {
  id: string;
  text: string;
  imageUrl: string;
  imageMeta?: {
    orientation?: 'landscape' | 'portrait';
  };
  difficulty: string;
  answers: { text: string; isCorrect: boolean }[];
};

export default function GamePage() {
  // --- State ---
  const [view, setView] = useState<'CATEGORIES' | 'QUIZZES' | 'LEVELS' | 'GAME' | 'RESULT'>('CATEGORIES');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Selections
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('medium');

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

  // --- Effects ---
  useEffect(() => {
    loadCategories();
  }, []);

  // --- Actions ---
  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectCategory = async (cat: Category) => {
    setSelectedCategory(cat);
    setIsLoading(true);
    try {
      const data = await getQuizzes(cat.id);
      setQuizzes(data.quizzes);
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
      setQuestions(questions);
      setView('LEVELS');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = (level: string) => {
    setSelectedLevel(level);
    
    // Filter by level and shuffle
    let filtered = questions.filter(q => (q.difficulty || 'medium') === level);
    
    // Fallback: if no questions for this level, take any to avoid empty game
    if (filtered.length === 0) filtered = questions;

    // Shuffle and take up to 20
    const shuffled = [...filtered].sort(() => Math.random() - 0.5).slice(0, 20);
    
    if (shuffled.length === 0) {
      alert("No questions found for this quiz/level.");
      return;
    }

    setGameQuestions(shuffled);
    setScore(0);
    setCurrentIndex(0);
    loadQuestion(shuffled[0]);
    setView('GAME');
  };

  const loadQuestion = (q: Question) => {
    // Shuffle answers
    const answers = q.answers.map((a, i) => ({ ...a, originalIdx: i }));
    setShuffledAnswers(answers.sort(() => Math.random() - 0.5));
    setAnswerState({ selectedIdx: null, isCorrect: false, locked: false });
  };

  const handleAnswer = (idx: number, isCorrect: boolean) => {
    if (answerState.locked) return;

    const newScore = isCorrect ? score + 1 : Math.max(0, score - 1);
    setScore(newScore);
    setAnswerState({ selectedIdx: idx, isCorrect, locked: true });

    // Auto advance
    setTimeout(() => {
      if (currentIndex < gameQuestions.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        loadQuestion(gameQuestions[nextIdx]);
      } else {
        setView('RESULT');
      }
    }, 2500);
  };

  const handleRestart = () => {
    setView('CATEGORIES');
    setSelectedCategory(null);
    setSelectedQuiz(null);
    setQuestions([]);
  };

  // --- Render Helpers ---
  const currentQ = gameQuestions[currentIndex];
  const isLandscape = currentQ?.imageMeta?.orientation !== 'portrait'; // Default to landscape

  return (
    <div className="game-root">
      {/* External Resources */}
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />

      <div id="shell">
        {/* Top Nav (Empty as per brief, but useful for back button during nav) */}
        <nav id="topnav">
          {view !== 'CATEGORIES' && view !== 'GAME' && view !== 'RESULT' && (
            <button onClick={() => setView('CATEGORIES')} className="nav-back">
              <span className="material-icons-round">arrow_back</span> Home
            </button>
          )}
        </nav>

        {/* --- VIEW: CATEGORIES --- */}
        {view === 'CATEGORIES' && (
          <section className="menu-view">
            <h1 className="menu-title">Select a Topic</h1>
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
            <h1 className="menu-title">{selectedCategory?.name}</h1>
            {isLoading ? <div className="loader">Loading...</div> : (
              <div className="card-grid">
                {quizzes.map(quiz => (
                  <div key={quiz.id} className="menu-card" onClick={() => selectQuiz(quiz)}>
                    <div className="card-img-wrap">
                      {quiz.imageUrl ? <img src={quiz.imageUrl} alt={quiz.title} /> : <div className="no-img">📝</div>}
                    </div>
                    <div className="card-label">{quiz.title}</div>
                    <div className="card-meta">{quiz.questionCount} Questions</div>
                  </div>
                ))}
                {quizzes.length === 0 && <div className="empty-msg">No quizzes found.</div>}
              </div>
            )}
          </section>
        )}

        {/* --- VIEW: LEVELS --- */}
        {view === 'LEVELS' && (
          <section className="menu-view centered">
            <div className="level-card">
              <div className="level-img">
                {selectedQuiz?.imageUrl && <img src={selectedQuiz.imageUrl} alt="Cover" />}
              </div>
              <h1 className="menu-title">{selectedQuiz?.title}</h1>
              <p className="menu-subtitle">Select Difficulty</p>
              
              <div className="level-buttons">
                {['easy', 'medium', 'hard'].map(level => (
                  <button key={level} className="level-btn" onClick={() => startGame(level)}>
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* --- VIEW: GAME --- */}
        {view === 'GAME' && currentQ && (
          <>
            <section id="content" className={isLandscape ? 'landscape' : 'portrait'}>
              {/* Image */}
              <div id="image-card">
                {currentQ.imageUrl ? (
                  <img id="trivia-img" src={currentQ.imageUrl} alt="Trivia image" />
                ) : (
                  <div className="no-game-img">Trivia Time</div>
                )}
              </div>

              {/* Panel */}
              <div id="panel">
                <div id="q-block">
                  <p id="q-text">{currentQ.text}</p>
                </div>

                <div id="answers">
                  {shuffledAnswers.map((ans, idx) => {
                    let statusClass = '';
                    if (answerState.locked) {
                      if (ans.isCorrect) statusClass = 'correct';
                      else if (answerState.selectedIdx === idx) statusClass = 'wrong';
                    }

                    return (
                      <button 
                        key={idx} 
                        className={`ans ${statusClass} ${answerState.locked ? 'locked' : ''}`}
                        onClick={() => handleAnswer(idx, ans.isCorrect)}
                      >
                        <div className="badge">{String.fromCharCode(65 + idx)}</div>
                        <div className="ans-label">{ans.text}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Bottom Bar */}
            <footer id="bottombar">
              <div className="bar-item lit">
                <span className="material-icons-round">quiz</span>
                <span id="q-counter">{currentIndex + 1} / {gameQuestions.length}</span>
              </div>

              <div className="bar-sep"></div>

              <div className="bar-item" style={{ gap: '10px' }}>
                <span style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Progress</span>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${((currentIndex) / gameQuestions.length) * 100}%` }}></div>
                </div>
              </div>

              <div className="bar-spacer"></div>

              <div className="bar-item lit">
                <span className="material-icons-round">star</span>
                <span id="score-val">Score: {score}</span>
              </div>
            </footer>
          </>
        )}

        {/* --- VIEW: RESULT --- */}
        {view === 'RESULT' && (
          <section className="menu-view centered">
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
          grid-template-rows: 96px 1fr 52px;
          background: var(--black);
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          color: var(--white);
          overflow: hidden;
          box-shadow: 0 0 50px rgba(0,0,0,0.5);
          /* Scale to fit viewport */
          transform-origin: center;
          /* In a real app, you might use JS to calculate scale, 
             but for now we assume it fits or user is on 1280+ screen */
        }
        @media (max-width: 1280px) {
          #shell { transform: scale(0.8); }
        }
        @media (max-width: 1000px) {
          #shell { transform: scale(0.6); }
        }

        /* ── Top nav ── */
        #topnav {
          background: var(--black);
          display: flex;
          align-items: center;
          padding: 0 24px;
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
          transition: transform 0.2s, background 0.2s;
        }
        .menu-card:hover {
          transform: translateY(-4px);
          background: var(--grey2);
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
          padding: 16px 16px 4px;
          font-size: 1.1rem;
          font-weight: 700;
        }
        .card-meta {
          padding: 0 16px 16px;
          font-size: 0.8rem;
          color: #888;
        }

        /* ── Level Selection ── */
        .level-card {
          text-align: center;
          width: 400px;
        }
        .level-img {
          width: 120px; height: 120px;
          border-radius: 20px;
          overflow: hidden;
          margin: 0 auto 20px;
          background: #222;
        }
        .level-img img { width: 100%; height: 100%; object-fit: cover; }
        .menu-subtitle { color: #888; margin-bottom: 30px; }
        .level-buttons { display: flex; flex-direction: column; gap: 12px; }
        .level-btn {
          background: var(--grey);
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

        /* ── Results ── */
        .result-card { text-align: center; }
        .result-icon { font-size: 5rem; margin-bottom: 10px; }
        .final-score { margin: 20px 0; }
        .score-big { font-size: 5rem; color: var(--teal); line-height: 1; }
        .score-total { font-size: 2rem; color: #666; }
        .result-msg { font-size: 1.5rem; color: #aaa; margin-bottom: 40px; }

        /* ─────────────────────────────────────
           GAME CONTENT AREA
        ───────────────────────────────────── */
        #content {
          padding: 14px 20px;
          display: grid;
          gap: 16px;
          background: var(--black);
          min-height: 0;
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
        }

        /* States */
        .ans.correct {
          background: var(--teal) !important;
          box-shadow: 0 4px 0 rgba(0,0,0,0.5) !important;
          animation: pop .3s ease;
          color: var(--black);
        }
        .ans.correct .badge {
          background: rgba(0,0,0,0.18);
          border-color: rgba(0,0,0,0.25);
          color: var(--black);
        }
        .ans.wrong {
          background: rgba(255,255,255,0.04) !important;
          box-shadow: 0 4px 0 rgba(0,0,0,0.3) !important;
          opacity: .32;
        }
        .ans.locked { pointer-events: none; }

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
          gap: 22px;
          height: 52px;
        }
        .bar-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
          white-space: nowrap;
        }
        .bar-item .material-icons-round {
          font-size: 1.1rem;
          color: var(--teal);
        }
        .bar-item.lit { color: var(--white); }
        .bar-sep { width: 1px; height: 26px; background: #2a2a2a; flex-shrink: 0; }
        .bar-spacer { flex: 1; }

        .prog-track {
          width: 150px; height: 5px;
          background: #2a2a2a;
          border-radius: 3px;
          overflow: hidden;
        }
        .prog-fill {
          height: 100%;
          background: var(--teal);
          border-radius: 3px;
          transition: width .6s ease;
        }
        .loader { color: #666; font-size: 1.5rem; text-align: center; margin-top: 50px; }
        .empty-msg { color: #666; text-align: center; margin-top: 50px; width: 100%; grid-column: 1/-1; }
      `}</style>
    </div>
  );
}