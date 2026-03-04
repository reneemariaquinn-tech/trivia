[**Trivia Pro**](../../../../README.md)

***

[Trivia Pro](../../../../modules.md) / app/admin/topics/actions

# app/admin/topics/actions

Server actions for managing the full trivia content hierarchy.

All functions run server-side via Next.js Server Actions and interact with
the `trivia` Firestore database within the `resparke-hub` Firebase project.

**Data model:**
- **Topics** (categories) → `topics` collection
- **Quizzes** → `quizzes` collection, linked to topics via `topicIds: string[]`
- **Questions** → `questions` collection, linked to quizzes via `quizIds: string[]`

Images sourced from Pexels or Wikimedia are downloaded, resized to max 1600×1000px,
and stored in Firebase Storage under the `trivia/` prefix before being saved to Firestore.

## Topics

- [getCategories](functions/getCategories.md)
- [deleteCategory](functions/deleteCategory.md)
- [upsertCategory](functions/upsertCategory.md)

## Quizzes

- [getQuizzes](functions/getQuizzes.md)
- [deleteQuiz](functions/deleteQuiz.md)
- [upsertQuiz](functions/upsertQuiz.md)

## Questions

- [getQuestions](functions/getQuestions.md)
- [deleteQuestion](functions/deleteQuestion.md)
- [bulkDeleteQuestions](functions/bulkDeleteQuestions.md)
- [bulkUpdateDifficulty](functions/bulkUpdateDifficulty.md)
- [upsertQuestion](functions/upsertQuestion.md)
- [bulkUploadQuestions](functions/bulkUploadQuestions.md)

## Images

- [autoAssignImage](functions/autoAssignImage.md)

## Audio

- [generateQuestionAudioWithTTS](functions/generateQuestionAudioWithTTS.md)

## Utilities

- [migrateQuestionMetadata](functions/migrateQuestionMetadata.md)
