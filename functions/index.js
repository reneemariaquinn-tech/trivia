/**
 * functions/index.js
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const archiver = require('archiver');
const axios = require('axios');

if (!admin.apps.length) {
  admin.initializeApp();
}

// 1. Point to the 'trivia' named database
const db = getFirestore('trivia');

// 2. Update these to the new 'resparke-hub' project links
const FEEDBACK_ASSETS = {
  correct: 'https://firebasestorage.googleapis.com/v0/b/resparke-hub.firebasestorage.app/o/trivia%2Fassets%2Fright-answer.mp3?alt=media',
  wrong: 'https://firebasestorage.googleapis.com/v0/b/resparke-hub.firebasestorage.app/o/trivia%2Fassets%2Fwrong-answer.mp3?alt=media'
};

exports.exportGameZip = functions.https.onRequest(async (req, res) => {
  // Enable CORS if calling via fetch, though window.open handles it naturally
  res.set('Access-Control-Allow-Origin', '*');

  const quizId = req.query.quizId;
  if (!quizId) {
    res.status(400).send('Missing quizId');
    return;
  }

  try {
    // 1. Fetch Game Data
    const quizDoc = await db.collection('quizzes').doc(quizId).get();
    if (!quizDoc.exists) {
      res.status(404).send('Quiz not found');
      return;
    }
    const quizData = quizDoc.data();

    // 2. Fetch Questions
    const questionsSnap = await db.collection('questions')
      .where('quizIds', 'array-contains', quizId)
      .get();
    
    const questions = [];
    questionsSnap.forEach(doc => {
      questions.push({ id: doc.id, ...doc.data() });
    });

    // 3. Prepare Archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.attachment(`${quizData.title || 'trivia-game'}.zip`);
    archive.pipe(res);

    // 4. Process Assets & Generate Data
    const processedQuestions = [];
    
    // Helper to download and add file to zip
    const downloadAndAddToZip = async (url, filename) => {
      try {
        const response = await axios.get(url, {
          responseType: 'stream',
          headers: {
            // Required by Wikimedia API policy; also polite for all providers
            'User-Agent': 'ResparkeTrivia/1.0 (https://resparke.com)'
          }
        });
        archive.append(response.data, { name: filename });
        return true;
      } catch (e) {
        console.error(`Failed to download ${url}: ${e.message}`);
        return false;
      }
    };

    // Loop through questions to handle assets
    for (const q of questions) {
      const qData = { ...q };
      
      // Handle Image
      if (q.imageUrl) {
        const ext = q.imageUrl.split('.').pop().split('?')[0] || 'jpg';
        const filename = `assets/img_${q.id}.${ext}`;
        await downloadAndAddToZip(q.imageUrl, filename);
        qData.imageUrl = filename; // Point to local file
      }

      // Handle Audio
      if (q.audioUrls && q.audioUrls.en) {
        const ext = 'mp3'; // Assuming mp3 for simplicity
        const filename = `assets/audio_${q.id}.${ext}`;
        await downloadAndAddToZip(q.audioUrls.en, filename);
        qData.audioUrl = filename; // Point to local file
      }

      processedQuestions.push(qData);
    }

    // Handle Cover Image
    let coverImageFilename = null;
    if (quizData.imageUrl) {
      const ext = quizData.imageUrl.split('.').pop().split('?')[0] || 'jpg';
      coverImageFilename = `assets/cover.${ext}`;
      await downloadAndAddToZip(quizData.imageUrl, coverImageFilename);
    }

    // Handle Feedback Audio
    // We attempt to download them; if they fail (e.g. 404), the game will just skip playing them.
    await downloadAndAddToZip(FEEDBACK_ASSETS.correct, 'assets/correct.mp3');
    await downloadAndAddToZip(FEEDBACK_ASSETS.wrong, 'assets/wrong.mp3');

    // 5. Generate Game Files
    const gameConfig = {
      title: quizData.title,
      questions: processedQuestions
    };

    // tailwind.config.js
    const tailwindConfigContent = `
tailwind.config = {
  theme: {
    extend: {
      colors: {
        teal: '#66e0e0',
        grey: '#1e1e1e',
        grey2: '#2c2c2c',
        black: '#000000',
        white: '#ffffff',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      }
    }
  }
}
`;

    // index.html
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-K6F8XSP');</script>
    <!-- End Google Tag Manager -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${quizData.title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="tailwind.config.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-K6F8XSP"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
    <div id="shell">
        <!-- LEVELS VIEW -->
        <section id="view-levels" class="menu-view centered level-view-container">
            <div class="lobby-card overlay-card">
                <div class="lobby-left">
                    ${coverImageFilename ? `<img src="${coverImageFilename}" alt="Cover">` : '<div class="no-img">📝</div>'}
                </div>
                <div class="lobby-right">
                    <h1 class="menu-title">${quizData.title}</h1>
                    
                    <div class="setting-row" style="display:none">
                        <span class="setting-label">Level</span>
                        <div class="mode-selector" id="level-selector">
                            <button class="mode-opt active" onclick="selectLevel('easy')">EASY</button>
                            <button class="mode-opt" onclick="selectLevel('medium')">MEDIUM</button>
                            <button class="mode-opt" onclick="selectLevel('hard')">HARD</button>
                        </div>
                    </div>
                    
                    <div class="setting-row">
                        <span class="setting-label">Game Type</span>
                        <div class="mode-selector" id="mode-selector">
                            <button class="mode-opt active" data-type="play" onclick="selectMode('play')">Guided</button>
                            <button class="mode-opt" data-type="quiet" onclick="selectMode('quiet')">Quiet</button>
                            <button class="mode-opt" data-type="auto" onclick="selectMode('auto')">Auto</button>
                        </div>
                    </div>

                    <div class="setting-row">
                        <span class="setting-label">Questions</span>
                        <div class="mode-selector" id="questions-selector">
                            <button class="mode-opt active" data-val="15" onclick="selectQuestionCount(15)">15</button>
                            <button class="mode-opt" data-val="30" onclick="selectQuestionCount(30)">30</button>
                            <button class="mode-opt" data-val="50" onclick="selectQuestionCount(50)">50</button>
                        </div>
                    </div>

                    <div class="mode-desc" id="mode-desc">Questions and audio guide you. Tap to move forward.</div>

                    <button class="level-btn primary" onclick="startGame()" style="margin-top: 20px; width: 100%">
                        Start Game
                    </button>
                </div>
            </div>
        </section>

        <!-- GAME VIEW -->
        <section id="view-game" style="display:none;">
            <section id="content" class="landscape">
                <div id="image-card">
                    <img id="question-img" style="opacity:0">
                    <div id="no-image-text" class="no-game-img">Trivia Time</div>
                    <div id="photo-credit" class="photo-credit"></div>
                </div>

                <div id="panel">
                    <div id="q-block">
                        <p id="q-text"></p>
                    </div>
                    <div id="answers"></div>
                </div>
            </section>

            <footer id="bottombar">
                <div class="bar-info">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33.14 24.55" width="33" height="24" style="color: var(--teal); height: 24px; width: auto;">
                        <path id="sparkle" fill="#66e0e0" d="M6.04,12.08l-.91-1.67c-.8-1.46-1.99-2.66-3.46-3.46l-1.67-.91,1.67-.91c1.46-.8,2.66-1.99,3.46-3.46l.91-1.67,.91,1.67c.8,1.46,1.99,2.66,3.46,3.46l1.67,.91-1.67,.91c-1.46,.8-2.66,1.99-3.46,3.46l-.91,1.67ZM3.55,6.04c.97,.68,1.81,1.53,2.49,2.49,.68-.97,1.53-1.81,2.49-2.49-.97-.68-1.81-1.53-2.49-2.49-.68,.97-1.53,1.81-2.49,2.49Z" />
                        <g id="text" fill="white">
                            <path d="M16.77,8.35c-.32-.04-.64-.07-.97-.07-4.2,0-7.61,3.41-7.61,7.61v8.32h2.62V15.89c0-2.76,2.24-5,5-5,.33,0,.66,.03,.97,.1v-2.64Z" />
                            <path d="M19.96,17.34c.4,2.9,2.74,4.67,6.28,4.67,2.3,0,4.31-.73,5.78-2.14h.13v2.87c-1.4,1.14-3.54,1.8-5.98,1.8-5.51,0-9.08-3.24-9.08-8.15s3.37-8.15,8.15-8.15,7.91,2.97,7.91,7.51v1.57h-13.19Zm0-2.37h10.55c-.4-2.54-2.4-4.17-5.24-4.17-2.67,0-4.77,1.67-5.31,4.17Z" />
                        </g>
                    </svg>
                    <div class="bar-sep"></div>
                    <div class="bar-item lit">
                        <span class="material-icons-round">list_alt</span>
                        <span id="q-counter"></span>
                    </div>
                    <div class="bar-sep" id="score-sep"></div>
                    <div class="bar-item lit" id="score-item">
                        <span class="material-icons-round">star</span>
                        <span id="score-val"></span>
                    </div>
                </div>

                <div class="bar-tools">
                    <button class="action-btn outline" id="btn-replay" onclick="replayAudio()">
                        <span class="material-icons-round">replay</span>
                        <span>Replay</span>
                    </button>
                    <button class="action-btn primary" id="btn-next" onclick="nextQuestion()">
                        <span>Next</span>
                        <span class="material-icons-round" style="font-size: 1.2em">arrow_forward</span>
                    </button>
                </div>
            </footer>
        </section>

        <!-- RESULT VIEW -->
        <section id="view-result" class="menu-view centered" style="display:none;">
            <div class="result-card">
                <div class="result-icon" id="result-icon">🏆</div>
                <h1 class="menu-title" id="result-title">Quiz Complete!</h1>
                <div class="final-score" id="result-score-container">
                    <span class="score-big" id="final-score"></span>
                    <span class="score-total" id="total-score"></span>
                </div>
                <p class="result-msg" id="result-msg"></p>
                <button class="level-btn primary" onclick="location.reload()">Play Again</button>
            </div>
        </section>
    </div>
    <script>
        const GAME_DATA = ${JSON.stringify(gameConfig)};
    </script>
    <script src="script.js"></script>
</body>
</html>`;

    // style.css
    const cssContent = `
/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --black:  #000000;
  --white:  #ffffff;
  --teal:   #66e0e0;
  --grey:   #1e1e1e;
  --grey2:  #2c2c2c;
  --dim:    rgba(255,255,255,0.35);
}

body {
  width: 100vw;
  height: 100vh;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: 'Poppins', sans-serif;
}

#shell {
  width: 1280px;
  height: 720px;
  display: grid;
  grid-template-rows: 1fr;
  background: var(--black);
  color: var(--white);
  overflow: hidden;
  box-shadow: 0 0 50px rgba(0,0,0,0.5);
  transform-origin: center center;
}

/* Menus */
.menu-view {
  padding: 20px 40px;
  overflow-y: auto;
  background: var(--black);
  width: 100%;
  height: 100%;
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

/* Lobby Card */
.lobby-card {
  background: var(--grey);
  padding: 0;
  border-radius: 24px;
  width: 1024px;
  max-width: 90vw;
  display: flex;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
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
.no-img {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 4rem;
}

/* Settings */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.setting-label { font-size: 1.2rem; font-weight: 600; color: #ccc; }

.mode-selector { display: flex; gap: 8px; background: #111; padding: 4px; border-radius: 12px; }
.mode-opt { flex: 1; background: transparent; border: none; color: #888; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.mode-opt.active { background: var(--white); color: var(--black); box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2); }

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

.mode-desc { margin-top: -10px; margin-bottom: 20px; font-size: 0.9rem; color: #666; min-height: 1.4em; }

.level-btn {
  background: #2c2c2c;
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
.level-btn.primary { background: var(--teal); color: var(--black); }
.level-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }

/* Game View */
#view-game {
    height: 100%;
    display: grid;
    grid-template-rows: 1fr 6rem;
}

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
  border-radius: 14px;
  overflow: hidden;
  position: relative;
  background: #0a0a0a;
}
#question-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity .4s ease;
  position: absolute;
  top: 0; left: 0;
  z-index: 1;
}
.no-game-img {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #333; font-size: 2rem; font-weight: 800;
  position: absolute; top: 0; left: 0; z-index: 0;
}
.photo-credit {
  position: absolute;
  bottom: 12px; left: 12px;
  background: var(--white);
  color: var(--black);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  z-index: 5;
}

#panel {
  grid-area: panel;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
#q-block { flex-shrink: 0; padding-bottom: 4px; }
#q-text {
  font-size: 2rem;
  font-weight: 600;
  color: var(--white);
  line-height: 1.35;
  padding: 16px 0;
}

#answers {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
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
  background: var(--grey);
  box-shadow: 0 4px 0 rgba(0,0,0,0.6);
  transition: transform .1s ease, background .12s ease, box-shadow .1s ease;
  color: var(--white);
  font-family: inherit;
}
.ans:hover { background: var(--grey2); transform: translateY(-2px); }
.ans:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.6); }

.badge {
  width: 54px; height: 54px;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  border: 2px solid rgba(255,255,255,0.14);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.7rem; font-weight: 700;
  color: rgba(255,255,255,0.5);
  flex-shrink: 0;
}
.ans-label {
  font-size: 2rem; font-weight: 600; line-height: 1.25;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

/* Answer States */
.ans.correct { background: #66e0e0; color: var(--black); }
.ans.correct .badge { background: rgba(0,0,0,0.18); border-color: rgba(0,0,0,0.25); color: var(--black); }

.ans.wrong { opacity: 0.32; }
.ans.wrong-selected { border: 2px solid #D58A94; color: #D58A94; }
.ans.wrong-selected .badge { border-color: #D58A94; color: #D58A94; }

.ans.correct-revealed { border: 3px solid #66e0e0; color: #66e0e0; }
.ans.correct-revealed .badge { border-color: #66e0e0; color: #66e0e0; }

/* Animations */
@keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes flip { 0% { transform: rotateX(0); } 100% { transform: rotateX(360deg); } }
@keyframes shake { 0% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } 100% { transform: translateX(0); } }

.anim-pop { animation: pop 0.3s ease forwards; }
.anim-flip { animation: flip 0.6s ease forwards; }
.anim-shake { animation: shake 0.4s ease forwards; }

.ans.auto-highlight {
    border: 2px solid #66e0e0;
    box-shadow: 0 0 15px rgba(102, 224, 224, 0.4);
}

.ans:disabled { cursor: default; }

/* Bottom Bar */
#bottombar {
  background: #0a0a0a;
  border-top: 1px solid #1e1e1e;
  display: flex;
  align-items: center;
  padding: 0 24px;
  justify-content: space-between;
  height: 6rem;
}
.bar-info { display: flex; align-items: center; gap: 24px; }
.bar-item { display: flex; align-items: center; gap: 7px; font-size: 1.5rem; font-weight: 600; color: rgba(255,255,255,0.6); }
.bar-item.lit { color: var(--white); }
.bar-item .material-icons-round { color: var(--teal); font-size: 1.1rem; }
.bar-sep { width: 1px; height: 40px; background: #2a2a2a; }
.bar-tools { display: flex; align-items: center; gap: 16px; }

.action-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  font-family: inherit; font-weight: 700; font-size: 1.2rem;
  cursor: pointer; transition: all 0.2s;
  border: 2px solid transparent;
  text-transform: uppercase;
}
.action-btn.primary { background: var(--teal); color: var(--black); border-color: var(--teal); }
.action-btn.outline { background: transparent; border-color: transparent; color: var(--white); }
.action-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* Results */
.result-card { text-align: center; }
.result-icon { font-size: 5rem; margin-bottom: 10px; }
.final-score { margin: 20px 0; }
.score-big { font-size: 5rem; color: var(--teal); line-height: 1; }
.score-total { font-size: 2rem; color: #666; }
.result-msg { font-size: 1.5rem; color: #aaa; margin-bottom: 40px; }
`;

    // script.js
    const jsContent = `
let selectedLevel = 'easy';
let selectedQuestionCount = 15;
let isAudioOn = true;
let gameMode = 'casual';
let gameQuestions = [];
let currentIdx = 0;
let score = 0;
let audio = null;
let locked = false;
const sfxCorrect = new Audio('assets/correct.mp3');
const sfxWrong = new Audio('assets/wrong.mp3');

// --- GTM ---
let gtmPayload = {};

function getGtmPayload() {
    const raw = new URLSearchParams(window.location.search).get('ga');
    if (!raw) return {};
    try {
        const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
        console.warn('Failed to parse GTM payload', e);
        return {};
    }
}

function pushEvent(event, eventData) {
    const genericPayload = {
        event_type: 'GAMES',
        game_type: 'Trivia',
        game_name: GAME_DATA.title,
    };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event,
        ...genericPayload,
        ...gtmPayload,
        ...eventData
    });
}

// --- Setup & Scaling ---
function handleResize() {
    const shell = document.getElementById('shell');
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    shell.style.transform = \`scale(\${scale})\`;
}
window.addEventListener('resize', handleResize);
handleResize();
gtmPayload = getGtmPayload();

// --- Lobby Logic ---
function selectLevel(level) {
    selectedLevel = level;
    document.querySelectorAll('#level-selector .mode-opt').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-val') === level);
    });
}

function selectQuestionCount(count) {
    selectedQuestionCount = count;
    document.querySelectorAll('#questions-selector .mode-opt').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === count);
    });
}

function selectMode(mode) {
    document.querySelectorAll('#mode-selector .mode-opt').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-type') === mode);
    });
    
    if (mode === 'auto') {
        gameMode = 'auto';
        isAudioOn = true;
    } else if (mode === 'quiet') {
        gameMode = 'casual';
        isAudioOn = false;
    } else {
        gameMode = 'casual';
        isAudioOn = true;
    }

    const desc = {
        play: "Questions and audio guide you. Tap to move forward.",
        quiet: "You read the questions aloud. Tap to move forward.",
        auto: "Runs automatically for relaxed viewing."
    };
    document.getElementById('mode-desc').innerText = desc[mode];
}

function startGame() {
    // Filter questions
    let filtered = GAME_DATA.questions.filter(q => (q.difficulty || 'medium') === selectedLevel);
    if (filtered.length === 0) filtered = GAME_DATA.questions; // Fallback

    // Shuffle
    gameQuestions = filtered.sort(() => Math.random() - 0.5).slice(0, selectedQuestionCount);
    
    if (gameQuestions.length === 0) {
        alert("No questions found.");
        return;
    }

    score = 0;
    currentIdx = 0;

    pushEvent('game_start', { game_mode: gameMode, game_questions: gameQuestions.length });

    document.getElementById('view-levels').style.display = 'none';
    document.getElementById('view-game').style.display = 'grid'; // grid for layout
    
    // Update UI based on mode
    if (gameMode === 'auto') {
        document.getElementById('btn-next').style.display = 'none';
        isAudioOn = true; // Force audio on
    } else {
        document.getElementById('btn-next').style.display = 'flex';
    }

    if (gameMode === 'stealth') {
        document.getElementById('score-sep').style.display = 'none';
        document.getElementById('score-item').style.display = 'none';
    }

    loadQuestion();
}

// --- Game Logic ---
function loadQuestion() {
    const q = gameQuestions[currentIdx];
    locked = false;
    
    // Reset UI
    document.getElementById('q-counter').innerText = \`\${currentIdx + 1} / \${gameQuestions.length}\`;
    document.getElementById('score-val').innerText = \`Score: \${score}\`;
    document.getElementById('q-text').innerText = q.text;
    
    // Image
    const img = document.getElementById('question-img');
    const noImg = document.getElementById('no-image-text');
    const credit = document.getElementById('photo-credit');
    
    img.style.opacity = 0;
    if (q.imageUrl) {
        img.src = q.imageUrl;
        img.onload = () => img.style.opacity = 1;
        noImg.style.display = 'none';
        if (q.imageMeta && q.imageMeta.photographer) {
            credit.innerText = 'Photo: ' + q.imageMeta.photographer;
            credit.style.display = 'block';
        } else {
            credit.style.display = 'none';
        }
    } else {
        noImg.style.display = 'flex';
        credit.style.display = 'none';
    }

    // Orientation
    const content = document.getElementById('content');
    const isLandscape = (q.imageMeta && q.imageMeta.orientation === 'landscape') || !q.imageMeta;
    content.className = isLandscape ? 'landscape' : 'portrait';

    // Answers
    const answersDiv = document.getElementById('answers');
    answersDiv.innerHTML = '';
    
    // We don't shuffle answers here to keep it simple and matching audio if generated
    q.answers.forEach((ans, idx) => {
        const btn = document.createElement('button');
        btn.className = 'ans';
        btn.id = 'btn-ans-' + idx;
        btn.disabled = (gameMode === 'auto'); // Disable interaction in auto mode
        
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.innerText = String.fromCharCode(65 + idx);
        
        const label = document.createElement('div');
        label.className = 'ans-label';
        label.innerText = ans.text;
        
        btn.appendChild(badge);
        btn.appendChild(label);
        
        btn.onclick = () => handleAnswer(idx, ans.isCorrect);
        answersDiv.appendChild(btn);
    });

    // Audio
    if (audio) { audio.pause(); }
    const replayBtn = document.getElementById('btn-replay');
    
    if (!isAudioOn) {
        replayBtn.style.display = 'none';
    } else {
        replayBtn.style.display = 'flex';
        replayBtn.disabled = true;
        replayBtn.style.opacity = 0.3;
    }

    if (q.audioUrl && isAudioOn) {
        audio = new Audio(q.audioUrl);
        audio.play().catch(e => console.log("Audio play failed", e));
        audio.onended = () => {
            if (gameMode === 'auto') runAutoSequence();
        };
        replayBtn.disabled = false;
        replayBtn.style.opacity = 1;
    } else if (gameMode === 'auto') {
        // If no audio in auto mode, start sequence immediately
        runAutoSequence();
    }
}

function replayAudio() {
    if (audio) {
        audio.currentTime = 0;
        audio.play();
    }
}

function handleAnswer(idx, isCorrect) {
    if (locked && gameMode !== 'stealth') return;
    locked = true;

    const q = gameQuestions[currentIdx];
    const btn = document.getElementById('btn-ans-' + idx);
    
    if (gameMode === 'stealth') {
        // Just highlight selected
        document.querySelectorAll('.ans').forEach(b => b.classList.remove('selected-stealth'));
        btn.classList.add('selected-stealth');
        // Store selection if we wanted to show results later, but for now just move on?
        // Actually stealth mode usually waits for "Next".
        return;
    }

    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }

    pushEvent('game_answer_question', {
        game_question_index: currentIdx + 1,
        game_question_text: q.text,
        game_is_correct: isCorrect,
    });

    if (isCorrect) {
        score++;
        if (isAudioOn) {
            sfxCorrect.currentTime = 0;
            sfxCorrect.play().catch(e => console.warn("Audio error:", e));
        }
        btn.classList.add('correct');
        btn.classList.add('anim-pop');
        btn.querySelector('.badge').innerHTML = '<span class="material-icons-round">check</span>';
    } else {
        if (isAudioOn) {
            sfxWrong.currentTime = 0;
            sfxWrong.play().catch(e => console.warn("Audio error:", e));
        }
        btn.classList.add('wrong-selected');
        btn.classList.add('anim-shake');
        btn.querySelector('.badge').innerHTML = '<span class="material-icons-round">close</span>';
        
        const label = btn.querySelector('.ans-label');
        if (label) label.innerHTML = '<span style="color: white">Nice Try!</span> ' + label.innerText;
        
        // Show correct
        const correctIdx = q.answers.findIndex(a => a.isCorrect);
        const correctBtn = document.getElementById('btn-ans-' + correctIdx);
        correctBtn.classList.add('correct-revealed');
    }
    
    document.getElementById('score-val').innerText = \`Score: \${score}\`;
}

function nextQuestion() {
    if (currentIdx < gameQuestions.length - 1) {
        currentIdx++;
        loadQuestion();
    } else {
        endGame();
    }
}

function runAutoSequence() {
    // 1.5s pause after audio
    setTimeout(() => {
        // Highlight
        document.querySelectorAll('.ans').forEach(b => b.classList.add('auto-highlight'));
        
        // 1.5s pause
        setTimeout(() => {
            // Reveal
            const q = gameQuestions[currentIdx];
            const correctIdx = q.answers.findIndex(a => a.isCorrect);
            
            document.querySelectorAll('.ans').forEach(b => b.classList.remove('auto-highlight'));
            
            const btn = document.getElementById('btn-ans-' + correctIdx);
            btn.classList.add('correct');
            btn.classList.add('anim-pop');
            sfxCorrect.play().catch(() => {});
            btn.querySelector('.badge').innerHTML = '<span class="material-icons-round">check</span>';
            
            score++; // Auto mode always gets it right visually? Or just reveals? 
            // "I hope you got everything right" implies we don't score user input.
            
            // 1.5s pause then next
            setTimeout(() => {
                nextQuestion();
            }, 1500);
            
        }, 1500);
    }, 1500);
}

function endGame() {
    pushEvent('game_finish', { game_score: score, game_questions: gameQuestions.length, game_mode: gameMode });

    document.getElementById('view-game').style.display = 'none';
    document.getElementById('view-result').style.display = 'flex';
    
    if (gameMode === 'auto') {
        document.getElementById('result-icon').innerText = '✨';
        document.getElementById('result-title').innerText = 'Game Over';
        document.getElementById('result-msg').innerText = 'I hope you got everything right!';
        document.getElementById('result-score-container').style.display = 'none';
    } else if (gameMode === 'stealth') {
        document.getElementById('result-icon').innerText = '📝';
        document.getElementById('result-title').innerText = 'Answers Revealed';
        document.getElementById('result-msg').innerText = 'Check your answers!';
        document.getElementById('result-score-container').style.display = 'none';
        // Ideally we'd show a list of answers here like the main app
    } else {
        document.getElementById('final-score').innerText = score;
        document.getElementById('total-score').innerText = '/ ' + gameQuestions.length;
        
        let msg = "Nice Try!";
        if (score === gameQuestions.length) msg = "Perfect Score!";
        else if (score > gameQuestions.length / 2) msg = "Great Job!";
        
        document.getElementById('result-msg').innerText = msg;
    }
}
`;

    archive.append(htmlContent, { name: 'index.html' });
    archive.append(cssContent, { name: 'style.css' });
    archive.append(jsContent, { name: 'script.js' });
    archive.append(tailwindConfigContent, { name: 'tailwind.config.js' });

    await archive.finalize();

  } catch (error) {
    console.error('Export failed', error);
    res.status(500).send('Export failed: ' + error.message);
  }
});
