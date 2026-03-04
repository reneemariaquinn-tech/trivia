[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / getQuizzes

# Function: getQuizzes()

> **getQuizzes**(`topicId`): `Promise`\<\{ `quizzes`: `object`[]; `topicTitle`: `any`; `categoryName`: `any`; \}\>

Defined in: app/admin/topics/actions.ts:173

Retrieves all quizzes belonging to a topic, with a live question count for each.

Fetches all questions in a single pass and counts how many reference each quiz
via their `quizIds` array. Also returns the parent topic's name for the page header.

## Parameters

### topicId

`string`

Firestore document ID of the parent topic.

## Returns

`Promise`\<\{ `quizzes`: `object`[]; `topicTitle`: `any`; `categoryName`: `any`; \}\>

Object containing `quizzes` (array), `topicTitle`, and `categoryName`.
