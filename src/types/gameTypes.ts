// ─── Game Type Registry ───────────────────────────────────────────────────────

export type GameTypeId = 'multi-answer' | 'reminiscing' | 'who-am-i' | 'multimillionaire' | 'who-sung';

export interface GameTypeMeta {
  id: GameTypeId;
  label: string;
  description: string;
  icon: string;
  badgeColor: string; // Tailwind classes for list badges
  cardColor: string;  // Tailwind classes for selector card accent
}

export const GAME_TYPES: GameTypeMeta[] = [
  {
    id: 'multi-answer',
    label: 'Multi Answer',
    description: '3-option multiple-choice trivia with images, audio, and difficulty levels.',
    icon: '🧠',
    badgeColor: 'bg-violet-100 text-violet-700',
    cardColor: 'border-violet-300 hover:bg-violet-50',
  },
  {
    id: 'reminiscing',
    label: 'Reminiscing',
    description: 'One image with 3 open-ended prompt questions to spark memories.',
    icon: '🖼️',
    badgeColor: 'bg-rose-100 text-rose-700',
    cardColor: 'border-rose-300 hover:bg-rose-50',
  },
  {
    id: 'who-am-i',
    label: 'Who Am I?',
    description: 'Progressive reveal: 3 clues, a blurred image, then the answer.',
    icon: '🔍',
    badgeColor: 'bg-amber-100 text-amber-700',
    cardColor: 'border-amber-300 hover:bg-amber-50',
  },
  {
    id: 'multimillionaire',
    label: 'Multimillionaire',
    description: '4-choice multiple-choice with difficulty scaling.',
    icon: '💰',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    cardColor: 'border-emerald-300 hover:bg-emerald-50',
  },
  {
    id: 'who-sung',
    label: 'Who Sung?',
    description: 'Audio-first: play a clip and guess the artist or song.',
    icon: '🎵',
    badgeColor: 'bg-blue-100 text-blue-700',
    cardColor: 'border-blue-300 hover:bg-blue-50',
  },
];

export function getGameTypeMeta(id: GameTypeId): GameTypeMeta {
  return GAME_TYPES.find(g => g.id === id) ?? GAME_TYPES[0];
}

// ─── Per-type item schemas ────────────────────────────────────────────────────

/**
 * Multi Answer: the existing trivia question structure.
 *
 * Maps directly to the `questions` Firestore collection.
 * - 3 answer options (A / B / C), exactly one marked isCorrect
 * - Optional cover image (Pexels / Wikimedia / uploaded)
 * - Optional per-language audio URLs generated via Google Cloud TTS
 * - Difficulty used for filtering and game-level scaling
 */
export interface MultiAnswerItem {
  gameType: 'multi-answer';
  /** Question body text */
  text: string;
  /** Exactly 3 answer options; one has isCorrect: true */
  answers: [
    { text: string; isCorrect: boolean },
    { text: string; isCorrect: boolean },
    { text: string; isCorrect: boolean },
  ];
  difficulty: 'easy' | 'medium' | 'hard';
  /** Firebase Storage URL for the question image */
  imageUrl?: string;
  imageMeta?: {
    orientation: 'landscape' | 'portrait';
    photographer?: string;
    source?: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
  };
  /** Keyed by BCP-47 language tag, e.g. { en: 'https://...' } */
  audioUrls?: Record<string, string>;
  /** Firestore document IDs of the quizzes this question belongs to */
  quizIds: string[];
}

/** Reminiscing: one image + three open-ended prompts */
export interface ReminiscingItem {
  gameType: 'reminiscing';
  imageUrl: string;
  prompts: [string, string, string];
}

/** Who Am I?: progressive-reveal with clues, blurred image, and answer */
export interface WhoAmIItem {
  gameType: 'who-am-i';
  imageUrl: string;
  clues: [string, string, string];
  answer: string;
}

/** Multimillionaire: classic 4-option MCQ with difficulty */
export interface MultimillionaireItem {
  gameType: 'multimillionaire';
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  difficulty: 'easy' | 'medium' | 'hard';
}

/** Who Sung?: audio clip + artist/title inputs */
export interface WhoSungItem {
  gameType: 'who-sung';
  audioUrl: string;
  artist: string;
  title: string;
  options?: string[]; // optional wrong-answer distractors
}

export type GameItem = MultiAnswerItem | ReminiscingItem | WhoAmIItem | MultimillionaireItem | WhoSungItem;
