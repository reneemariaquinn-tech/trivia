[**Trivia Pro**](../../../../README.md)

***

[Trivia Pro](../../../../modules.md) / [app/game/triviaAudioGenerator](../README.md) / processTriviaAudio

# Function: processTriviaAudio()

> **processTriviaAudio**(`trivia`, `targetLang`): `Promise`\<[`ProcessedTriviaResponse`](../interfaces/ProcessedTriviaResponse.md)\>

Defined in: [app/game/triviaAudioGenerator.ts:91](https://bitbucket.org/resparke/trivia-pro/src/a2a6ebb4e0fe8382a5f23423f215a04c19617b0e/app/game/triviaAudioGenerator.ts#lines-91)

Full TTS pipeline: translate → SSML → synthesise → upload → return URL.

**SSML script structure:**
1. Question text (5+ underscores/hyphens replaced with "blank")
2. 2 000 ms pause
3. Question text repeated
4. 1 500 ms pause
5. Answers: `A: {ans}` / `B: {ans}` / `C: {ans}` with 1 000 ms pauses between

**Voice selection:**
- English → `en-AU-Standard-C` at 0.75× speaking rate
- Other languages → first available Neural2 voice, with Standard voice as fallback

Audio is stored at `trivia/question-tts/{timestamp}-{uuid}-{lang}.mp3` with a
`firebaseStorageDownloadTokens` metadata entry to generate a persistent URL.

## Parameters

### trivia

[`TriviaInput`](../interfaces/TriviaInput.md)

Question text and answer options to synthesise.

### targetLang

`string`

BCP-47 base language code, e.g. `'en'`, `'fr'`, `'es'`.

## Returns

`Promise`\<[`ProcessedTriviaResponse`](../interfaces/ProcessedTriviaResponse.md)\>

Translated content and the Firebase Storage audio URL.

## Throws

If TTS synthesis fails or the audio buffer is empty.
