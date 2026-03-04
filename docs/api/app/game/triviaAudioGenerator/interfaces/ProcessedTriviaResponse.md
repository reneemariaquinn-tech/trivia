[**Trivia Pro**](../../../../README.md)

***

[Trivia Pro](../../../../modules.md) / [app/game/triviaAudioGenerator](../README.md) / ProcessedTriviaResponse

# Interface: ProcessedTriviaResponse

Defined in: [app/game/triviaAudioGenerator.ts:59](https://bitbucket.org/resparke/trivia-pro/src/a2a6ebb4e0fe8382a5f23423f215a04c19617b0e/app/game/triviaAudioGenerator.ts#lines-59)

Output of the TTS pipeline.

## Properties

### translatedText

> **translatedText**: `object`

Defined in: [app/game/triviaAudioGenerator.ts:61](https://bitbucket.org/resparke/trivia-pro/src/a2a6ebb4e0fe8382a5f23423f215a04c19617b0e/app/game/triviaAudioGenerator.ts#lines-61)

The (possibly translated) question and answers returned for storage.

#### question

> **question**: `string`

#### answers

> **answers**: `string`[]

***

### audioUrl

> **audioUrl**: `string`

Defined in: [app/game/triviaAudioGenerator.ts:66](https://bitbucket.org/resparke/trivia-pro/src/a2a6ebb4e0fe8382a5f23423f215a04c19617b0e/app/game/triviaAudioGenerator.ts#lines-66)

Persistent Firebase Storage download URL for the generated MP3.
