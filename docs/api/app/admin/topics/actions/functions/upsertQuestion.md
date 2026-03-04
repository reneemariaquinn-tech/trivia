[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / upsertQuestion

# Function: upsertQuestion()

> **upsertQuestion**(`questionId`, `quizId`, `formData`): `Promise`\<`any`\>

Defined in: app/admin/topics/actions.ts:447

Creates or updates a question, handling image and audio asset management.

**Image handling:** If the image URL is an external source (Pexels / Wikimedia),
it is fetched server-side, auto-rotated, resized to max 1600×1000px, and stored
in Firebase Storage at `trivia/question-images/imported/`. Orientation (`landscape`
or `portrait`) is detected from the image dimensions and saved to `imageMeta`.

**Audio handling:** Existing `audioUrls` for other languages are preserved.
A new audio file upload via `audioFile` form field overwrites the English (`en`) entry.

## Parameters

### questionId

Existing question ID to update, or `null` to create a new question.

`string` | `null`

### quizId

`string`

Parent quiz ID. Used to set `quizIds` on new questions.

### formData

`FormData`

Form fields:
  - `text` — question text
  - `difficulty` — `'easy'`, `'medium'`, or `'hard'`
  - `opt0`, `opt1`, `opt2` — answer option texts
  - `correctIndex` — `'0'`, `'1'`, or `'2'` (index of the correct answer)
  - `existingImageUrl` — current image URL (Firebase Storage or external)
  - `orientation` — manual override: `'landscape'` or `'portrait'`
  - `imagePhotographer` — attribution name (saved to `imageMeta`)
  - `imageSource` — attribution source (e.g. `'Pexels'`)
  - `audioFile` — optional new audio file (overwrites `audioUrls.en`)
  - `existingAudioUrl` — current English audio URL to preserve

## Returns

`Promise`\<`any`\>

The saved question data including its Firestore `id`.
