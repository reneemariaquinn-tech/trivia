[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / getCategories

# Function: getCategories()

> **getCategories**(): `Promise`\<`object`[]\>

Defined in: app/admin/topics/actions.ts:51

Retrieves all topics (categories) with a live quiz count for each.

Fetches all quizzes in a single pass and counts how many reference each topic
via their `topicIds` array, avoiding N+1 queries.

## Returns

`Promise`\<`object`[]\>

Array of topic objects including `id`, `name`, `imageUrl`, `quizCount`,
  `createdAt`, and `updatedAt` (ISO strings).
