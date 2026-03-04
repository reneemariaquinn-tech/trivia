[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / getQuestions

# Function: getQuestions()

> **getQuestions**(`quizId`): `Promise`\<\{ `questions`: `object`[]; `quiz`: \{ `id`: `string`; `createdAt`: `any`; `updatedAt`: `any`; \} \| `null`; \}\>

Defined in: app/admin/topics/actions.ts:328

Retrieves all questions for a quiz, along with the parent quiz document.

Firestore `Timestamp` values in `imageMeta` are safely serialised to ISO strings
so they can be passed across the server/client boundary.

## Parameters

### quizId

`string`

Firestore document ID of the quiz.

## Returns

`Promise`\<\{ `questions`: `object`[]; `quiz`: \{ `id`: `string`; `createdAt`: `any`; `updatedAt`: `any`; \} \| `null`; \}\>

Object with `questions` (array) and `quiz` (the parent quiz document or `null`).
