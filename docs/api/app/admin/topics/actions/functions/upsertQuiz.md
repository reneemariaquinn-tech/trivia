[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / upsertQuiz

# Function: upsertQuiz()

> **upsertQuiz**(`id`, `topicId`, `formData`): `Promise`\<`void`\>

Defined in: app/admin/topics/actions.ts:249

Creates or updates a quiz.

On create, the quiz is linked to `topicId` via the `topicIds` array.
On update, `topicId` (if provided) is merged into the existing `topicIds` array via `arrayUnion`,
preserving any existing topic relationships.

External images (from AI search) are downloaded, resized, and stored at `trivia/quiz-covers/imported/`.

## Parameters

### id

Existing quiz ID to update, or `null` to create a new quiz.

`string` | `null`

### topicId

Parent topic ID. Required when creating; optional when updating.

`string` | `null`

### formData

`FormData`

Form fields:
  - `name` / `title` — quiz title
  - `description` — optional description
  - `existingImageUrl` — current cover image URL (Firebase Storage or external)

## Returns

`Promise`\<`void`\>
