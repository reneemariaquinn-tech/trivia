[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / upsertCategory

# Function: upsertCategory()

> **upsertCategory**(`id`, `formData`): `Promise`\<`void`\>

Defined in: app/admin/topics/actions.ts:103

Creates or updates a topic/category.

If the provided image URL is an external HTTP source (i.e. from an AI image search),
it is fetched, resized to a max of 1600×1000px via Sharp, and stored in Firebase Storage
at `trivia/topic-covers/imported/`. A persistent download URL is then saved to Firestore.

## Parameters

### id

Existing topic ID to update, or `null` to create a new topic.

`string` | `null`

### formData

`FormData`

Form fields:
  - `name` / `title` — display name of the category
  - `existingImageUrl` — current image URL (Firebase Storage or external)

## Returns

`Promise`\<`void`\>
