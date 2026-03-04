[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / bulkUpdateDifficulty

# Function: bulkUpdateDifficulty()

> **bulkUpdateDifficulty**(`ids`, `difficulty`): `Promise`\<`void`\>

Defined in: app/admin/topics/actions.ts:412

Sets the difficulty level for multiple questions in a single Firestore batch operation.

## Parameters

### ids

`string`[]

Array of Firestore document IDs to update.

### difficulty

`string`

Target difficulty level: `'easy'`, `'medium'`, or `'hard'`.

## Returns

`Promise`\<`void`\>
