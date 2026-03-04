[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / generateQuestionAudioWithTTS

# Function: generateQuestionAudioWithTTS()

> **generateQuestionAudioWithTTS**(`questionId`, `language`): `Promise`\<\{ `success`: `boolean`; `audioUrl`: `any`; `error?`: `undefined`; \} \| \{ `audioUrl?`: `undefined`; `success`: `boolean`; `error`: `any`; \}\>

Defined in: app/admin/topics/actions.ts:777

Generates a TTS (Text-to-Speech) audio file for a question and saves it to Firestore.

Fetches the question text and answers, passes them to [processTriviaAudio](../../../../game/triviaAudioGenerator/functions/processTriviaAudio.md) which:
- Optionally translates the content (skipped for `'en'`)
- Builds an SSML script: question → 2s pause → question repeat → 1.5s pause → answers A/B/C
- Synthesises audio using Google Cloud TTS (English: `en-AU-Standard-C` at 0.75× speed)
- Uploads the MP3 to Firebase Storage at `trivia/question-tts/`

The resulting URL is saved to `audioUrls.{language}` on the question document.
A 30-second timeout prevents the action from hanging on slow API responses.

## Parameters

### questionId

`string`

Firestore document ID of the question.

### language

`string`

BCP-47 language code, e.g. `'en'`, `'fr'`, `'es'`.

## Returns

`Promise`\<\{ `success`: `boolean`; `audioUrl`: `any`; `error?`: `undefined`; \} \| \{ `audioUrl?`: `undefined`; `success`: `boolean`; `error`: `any`; \}\>

`{ success: true, audioUrl }` on success, or `{ success: false, error }` on failure.
