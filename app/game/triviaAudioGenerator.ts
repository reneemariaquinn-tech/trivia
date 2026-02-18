import { v2 } from '@google-cloud/translate';
import textToSpeech from '@google-cloud/text-to-speech';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';

// Helper to load credentials from Env Var (Best Practice) or File (Local Fallback)
const getCredentials = () => {
  // 1. Check for stringified JSON in Environment Variable
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (error) {
      console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_KEY:', error);
    }
  }
  
  // 2. Check for individual fields (Common alternative)
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PROJECT_ID) {
    return {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle escaped newlines
      project_id: process.env.GOOGLE_PROJECT_ID,
    };
  }

  // 3. Fallback: Let Google Libraries find it automatically via GOOGLE_APPLICATION_CREDENTIALS
  // or return undefined so the library attempts Application Default Credentials (ADC)
  return undefined;
};

const credentials = getCredentials();
const getClientConfig = () => (credentials ? { credentials } : {});

// Initialize Google Cloud clients
const translate = new v2.Translate(getClientConfig());
const ttsClient = new textToSpeech.TextToSpeechClient(getClientConfig());

// Determine bucket name from Env Var or Credentials
const projectId = credentials?.project_id;
const storageBucket = 'resparke-hub.firebasestorage.app';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const adminConfig = credentials 
    ? { credential: admin.credential.cert(credentials), storageBucket }
    : { storageBucket }; // Falls back to GOOGLE_APPLICATION_CREDENTIALS path if set
    
  admin.initializeApp(adminConfig);
}

interface TriviaInput {
  question: string;
  answers: string[];
}

interface ProcessedTriviaResponse {
  translatedText: {
    question: string;
    answers: string[];
  };
  audioUrl: string;
}

/**
 * Translates trivia content, generates audio with specific timing, and uploads to Firebase.
 * 
 * @param trivia - Object containing question and answers
 * @param targetLang - Target language code (e.g., 'fr', 'es', 'en')
 * @returns Object containing translated text and audio URL
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

    // Build SSML with 1.5s pause and repetition
    const ssml = `
      <speak>
        ${translatedQuestion}
        <break time="2000ms"/>
        ${translatedQuestion}
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
    console.log(`Uploading audio to bucket: ${storageBucket}`);
    const bucket = admin.storage().bucket(storageBucket);
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

    // Generate a persistent URL (mimicking Firebase Client SDK)
    const bucketName = storageBucket.replace(/^gs:\/\//, '');
    const persistentUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;

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