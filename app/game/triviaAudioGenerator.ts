/**
 * @packageDocumentation
 * Google Cloud TTS audio generation pipeline for trivia questions.
 *
 * Translates question + answers (if needed), builds an SSML script with pauses and
 * answer-letter prefixes, synthesises MP3 audio via Google Cloud TTS, and uploads
 * the result to Firebase Storage with a persistent download token URL.
 *
 * **Google Cloud credentials** are loaded from environment variables:
 * - `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string), or
 * - `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` + `GOOGLE_PROJECT_ID`, or
 * - Application Default Credentials (ADC) via `GOOGLE_APPLICATION_CREDENTIALS`
 *
 * Firebase Admin (for Storage upload) is shared from `src/lib/firebase-admin.ts`.
 */
import { v2 } from '@google-cloud/translate';
import textToSpeech from '@google-cloud/text-to-speech';
import { adminStorage } from '@/lib/firebase-admin';
import { randomUUID } from 'crypto';

// Helper to load credentials for Google Cloud clients (Translate, TTS)
// Note: Firebase Admin is initialised in src/lib/firebase-admin.ts
const getCredentials = () => {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (error) {
      console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_KEY:', error);
    }
  }

  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PROJECT_ID) {
    return {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      project_id: process.env.GOOGLE_PROJECT_ID,
    };
  }

  return undefined;
};

const credentials = getCredentials();
const getClientConfig = () => (credentials ? { credentials } : {});

// Initialize Google Cloud clients
const translate = new v2.Translate(getClientConfig());
const ttsClient = new textToSpeech.TextToSpeechClient(getClientConfig());

/** Input for the TTS pipeline: the raw question text and its answer options. */
export interface TriviaInput {
  /** The question text, including any fill-in-the-blank underscores. */
  question: string;
  /** Answer options in display order (A, B, C). */
  answers: string[];
}

/** Output of the TTS pipeline. */
export interface ProcessedTriviaResponse {
  /** The (possibly translated) question and answers returned for storage. */
  translatedText: {
    question: string;
    answers: string[];
  };
  /** Persistent Firebase Storage download URL for the generated MP3. */
  audioUrl: string;
}

/**
 * Full TTS pipeline: translate → SSML → synthesise → upload → return URL.
 *
 * **SSML script structure:**
 * 1. Question text (5+ underscores/hyphens replaced with "blank")
 * 2. 2 000 ms pause
 * 3. Question text repeated
 * 4. 1 500 ms pause
 * 5. Answers: `A: {ans}` / `B: {ans}` / `C: {ans}` with 1 000 ms pauses between
 *
 * **Voice selection:**
 * - English → `en-AU-Standard-C` at 0.75× speaking rate
 * - Other languages → first available Neural2 voice, with Standard voice as fallback
 *
 * Audio is stored at `trivia/question-tts/{timestamp}-{uuid}-{lang}.mp3` with a
 * `firebaseStorageDownloadTokens` metadata entry to generate a persistent URL.
 *
 * @param trivia - Question text and answer options to synthesise.
 * @param targetLang - BCP-47 base language code, e.g. `'en'`, `'fr'`, `'es'`.
 * @returns Translated content and the Firebase Storage audio URL.
 * @throws If TTS synthesis fails or the audio buffer is empty.
 */
export async function processTriviaAudio(
  trivia: TriviaInput,
  targetLang: string
): Promise<ProcessedTriviaResponse> {
  try {
    // --- Step A: Translate ---
    let translatedQuestion = trivia.question;
    let translatedAnswers = trivia.answers;

    if (targetLang !== 'en') {
      // Translate the question
      const [tq] = await translate.translate(trivia.question, targetLang);
      translatedQuestion = tq;

      // Translate answers
      translatedAnswers = await Promise.all(
        trivia.answers.map(async (answer) => {
          const [translated] = await translate.translate(answer, targetLang);
          return translated;
        })
      );
    }

    // --- Step B: SSML Construction ---
    // Format options: "A: [answer 0], B: [answer 1], ..."
    const optionsText = translatedAnswers
      .map((ans, index) => `<say-as interpret-as="characters">${String.fromCharCode(65 + index)}</say-as>: ${ans}`)
      .join('<break time="1000ms"/>');

    // Replace 5+ underscores or hyphens with "blank" for TTS using SSML substitution
    const ssmlQuestion = translatedQuestion.replace(/([_\-]{5,})/g, '<sub alias="blank">$1</sub>');

    // Build SSML with 1.5s pause and repetition
    const ssml = `
      <speak>
        ${ssmlQuestion}
        <break time="2000ms"/>
        ${ssmlQuestion}
        <break time="1500ms"/>
        ${optionsText}
      </speak>
    `;

    // --- Step C: TTS ---
    let languageCode = targetLang;
    let voiceName = '';

    if (targetLang === 'en') {
      // Specific requirement for English: Australian Standard C
      languageCode = 'en-AU';
      voiceName = 'en-AU-Standard-C';
    } else {
      // Find corresponding Neural2 voice for other languages
      const [voicesResponse] = await ttsClient.listVoices({ languageCode: targetLang });
      const voices = voicesResponse.voices || [];
      
      // Prefer Neural2 voices matching the target language
      const neural2Voice = voices.find(
        (v) => v.name?.includes('Neural2') && v.languageCodes?.some(code => code.startsWith(targetLang))
      );

      if (neural2Voice) {
        languageCode = neural2Voice.languageCodes?.[0] || targetLang;
        voiceName = neural2Voice.name || '';
      } else {
        // Fallback to any voice for the language if Neural2 is not available
        const fallbackVoice = voices.find(v => v.languageCodes?.some(code => code.startsWith(targetLang)));
        if (fallbackVoice) {
          languageCode = fallbackVoice.languageCodes?.[0] || targetLang;
          voiceName = fallbackVoice.name || '';
        }
      }
    }

    const ttsRequest = {
      input: { ssml },
      voice: { languageCode, name: voiceName },
      audioConfig: { 
        audioEncoding: 'MP3' as const,
        speakingRate: 0.75, // Slow down the speaking rate (default is 1.0)
      },
    };

    const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
    const audioBuffer = ttsResponse.audioContent;

    if (!audioBuffer) {
      throw new Error('Failed to generate audio content');
    }

    // --- Step D: Firebase Upload ---
    const bucket = adminStorage.bucket();
    const fileName = `trivia/question-tts/${Date.now()}-${randomUUID()}-${targetLang}.mp3`;
    const file = bucket.file(fileName);
    const token = randomUUID();

    await file.save(Buffer.from(audioBuffer), {
      metadata: {
        contentType: 'audio/mpeg',
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const persistentUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;

    return {
      translatedText: {
        question: translatedQuestion,
        answers: translatedAnswers,
      },
      audioUrl: persistentUrl,
    };

  } catch (error) {
    console.error('Error processing trivia audio:', error);
    throw error;
  }
}