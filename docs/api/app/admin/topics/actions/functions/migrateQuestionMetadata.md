[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / migrateQuestionMetadata

# Function: migrateQuestionMetadata()

> **migrateQuestionMetadata**(): `Promise`\<`number`\>

Defined in: app/admin/topics/actions.ts:739

One-time migration utility: backfills `orientation` and `aspectRatio` onto question
documents that have `imageMeta.width` but are missing the orientation field.

Safe to run multiple times — only updates documents that need it.

## Returns

`Promise`\<`number`\>

The number of documents updated.
