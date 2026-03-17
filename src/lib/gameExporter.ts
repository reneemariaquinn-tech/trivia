/**
 * gameExporter.ts
 *
 * Maps internal Firestore quiz/item data to the game-specific JSON export
 * templates consumed by the front-end game player.
 *
 * Each export function returns a plain object ready to be serialised with
 * JSON.stringify() and written to a ZIP or served as a download.
 */

import type { GameTypeId } from '@/types/gameTypes';

// ─── Export dispatcher ────────────────────────────────────────────────────────

/**
 * Build the content_template JSON for a quiz based on its game type.
 *
 * @param gameType  - The game mode identifier stored on the quiz document.
 * @param quizMeta  - Top-level quiz fields (title, imageUrl, etc.).
 * @param items     - The quiz's question/item documents from Firestore.
 */
export function exportGameTemplate(
  gameType: GameTypeId,
  quizMeta: Record<string, unknown>,
  items: Record<string, unknown>[],
): object {
  switch (gameType) {
    case 'multi-answer':
      return exportMultiAnswer(quizMeta, items);
    case 'reminiscing':
      return exportReminiscing(quizMeta, items);
    case 'who-am-i':
      return exportWhoAmI(quizMeta, items);
    case 'multimillionaire':
      return exportMultimillionaire(quizMeta, items);
    case 'who-sung':
      return exportWhoSung(quizMeta, items);
  }
}

// ─── Per-type exporters ───────────────────────────────────────────────────────

function exportMultiAnswer(
  meta: Record<string, unknown>,
  items: Record<string, unknown>[],
): object {
  return {
    game_type: 'multi-answer',
    title: meta.title,
    items: items.map(item => ({
      question: item.text ?? '',
      answers: (item.answers as { text: string; isCorrect: boolean }[] | undefined) ?? [],
      difficulty: item.difficulty ?? 'medium',
      image_url: item.imageUrl ?? '',
      audio_urls: item.audioUrls ?? {},
    })),
  };
}

function exportReminiscing(
  meta: Record<string, unknown>,
  items: Record<string, unknown>[],
): object {
  return {
    game_type: 'reminiscing',
    title: meta.title,
    items: items.map(item => {
      // Prompts are stored in the existing answers[] array (text field only, isCorrect is always false)
      const answers = (item.answers as { text: string }[] | undefined) ?? [];
      const prompts = answers.map(a => a.text).filter(Boolean);
      return {
        image_url: item.imageUrl ?? '',
        scene_text: item.text ?? '',
        prompts,
      };
    }),
  };
}

function exportWhoAmI(
  meta: Record<string, unknown>,
  items: Record<string, unknown>[],
): object {
  return {
    game_type: 'who-am-i',
    title: meta.title,
    items: items.map(item => ({
      image_url: item.imageUrl ?? '',
      clues: (item.clues as string[] | undefined) ?? ['', '', ''],
      answer: item.answer ?? '',
    })),
  };
}

function exportMultimillionaire(
  meta: Record<string, unknown>,
  items: Record<string, unknown>[],
): object {
  return {
    game_type: 'multimillionaire',
    title: meta.title,
    items: items.map(item => ({
      question: item.text ?? item.question ?? '',
      options: (item.answers as { text: string }[] | undefined)?.map(a => a.text) ?? ['', '', '', ''],
      correct_index: item.correctIndex ?? 0,
      difficulty: item.difficulty ?? 'medium',
    })),
  };
}

function exportWhoSung(
  meta: Record<string, unknown>,
  items: Record<string, unknown>[],
): object {
  return {
    game_type: 'who-sung',
    title: meta.title,
    items: items.map(item => ({
      audio_url: item.audioUrl ?? '',
      artist: item.artist ?? '',
      title: item.title ?? '',
      options: (item.options as string[] | undefined) ?? [],
    })),
  };
}
