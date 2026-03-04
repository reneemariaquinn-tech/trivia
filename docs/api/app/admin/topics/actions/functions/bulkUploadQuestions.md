[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / bulkUploadQuestions

# Function: bulkUploadQuestions()

> **bulkUploadQuestions**(`quizId`, `jsonData`): `Promise`\<\{ `success`: `boolean`; `count`: `number`; \}\>

Defined in: app/admin/topics/actions.ts:605

Bulk-imports questions from a JSON string (parsed from CSV in the UI).

Splits large imports into chunks of 450 to stay within Firestore's 500-operation
batch limit. Each question is created with `imageStatus: 'pending'` so images
can be assigned later via the AI image search bulk action.

**Expected CSV column order:** `question, option1, option2, option3, correctIndex, difficulty`
where `correctIndex` is 1-based (`1`, `2`, or `3`).

## Parameters

### quizId

`string`

Firestore document ID of the quiz to import into.

### jsonData

`string`

JSON-stringified array of question objects.

## Returns

`Promise`\<\{ `success`: `boolean`; `count`: `number`; \}\>

`{ success: true, count: number }` with the total number of questions created.
