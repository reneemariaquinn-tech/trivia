[**Trivia Pro**](../../../../../README.md)

***

[Trivia Pro](../../../../../modules.md) / [app/admin/topics/actions](../README.md) / autoAssignImage

# Function: autoAssignImage()

> **autoAssignImage**(`questionId`, `searchQuery`): `Promise`\<\{ `imageUrl`: `string`; `imageStatus`: `string`; `imageSource`: `string`; `imageMeta`: \{ `provider`: `string`; `photographer`: `any`; `width`: `any`; `height`: `any`; `aspectRatio`: `number`; `orientation`: `string`; `updatedAt`: `string`; \}; \}\>

Defined in: app/admin/topics/actions.ts:667

Automatically finds and assigns an image to a question using the Pexels API.

Searches Pexels for the given query (landscape orientation), downloads the top result,
resizes it to max 1600×1000px, and stores it in Firebase Storage at
`trivia/question-images/automated/{questionId}.jpg`. The question document is updated
with the new `imageUrl`, `imageStatus: 'found'`, and full `imageMeta` (photographer,
dimensions, aspect ratio, orientation).

## Parameters

### questionId

`string`

Firestore document ID of the question to update.

### searchQuery

`string`

Search term used to find a relevant image (defaults to question text).

## Returns

`Promise`\<\{ `imageUrl`: `string`; `imageStatus`: `string`; `imageSource`: `string`; `imageMeta`: \{ `provider`: `string`; `photographer`: `any`; `width`: `any`; `height`: `any`; `aspectRatio`: `number`; `orientation`: `string`; `updatedAt`: `string`; \}; \}\>

The updated image fields: `imageUrl`, `imageStatus`, `imageSource`, `imageMeta`.

## Throws

Error if `PEXELS_API_KEY` is missing or no image is found for the query.
