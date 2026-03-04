[**Trivia Pro**](../../../README.md)

***

[Trivia Pro](../../../modules.md) / app/game/triviaAudioGenerator

# app/game/triviaAudioGenerator

Google Cloud TTS audio generation pipeline for trivia questions.

Translates question + answers (if needed), builds an SSML script with pauses and
answer-letter prefixes, synthesises MP3 audio via Google Cloud TTS, and uploads
the result to Firebase Storage with a persistent download token URL.

**Google Cloud credentials** are loaded from environment variables:
- `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string), or
- `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` + `GOOGLE_PROJECT_ID`, or
- Application Default Credentials (ADC) via `GOOGLE_APPLICATION_CREDENTIALS`

Firebase Admin (for Storage upload) is shared from `src/lib/firebase-admin.ts`.

## Functions

- [processTriviaAudio](functions/processTriviaAudio.md)

## Interfaces

- [TriviaInput](interfaces/TriviaInput.md)
- [ProcessedTriviaResponse](interfaces/ProcessedTriviaResponse.md)
