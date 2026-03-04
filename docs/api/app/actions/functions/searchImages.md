[**Trivia Pro**](../../../README.md)

***

[Trivia Pro](../../../modules.md) / [app/actions](../README.md) / searchImages

# Function: searchImages()

> **searchImages**(`query`, `provider`): `Promise`\<`any`\>

Defined in: [app/actions.ts:22](https://bitbucket.org/resparke/trivia-pro/src/a2a6ebb4e0fe8382a5f23423f215a04c19617b0e/app/actions.ts#lines-22)

Searches for images from Pexels or Wikimedia Commons and returns a normalised result set.

**Pexels:** Returns up to 6 landscape photos. Requires `PEXELS_API_KEY` environment variable.

**Wikimedia Commons:** Returns up to 6 images from the File namespace. Portrait images are
capped at 1000px wide to avoid oversized downloads.

Results from both providers are normalised to `{ url, photographer, source }` objects
so the UI can treat them identically.

## Parameters

### query

`string`

Search term (e.g. `"Sydney Opera House"`)

### provider

Image source: `'pexels'` or `'wikimedia'`

`"pexels"` | `"wikimedia"`

## Returns

`Promise`\<`any`\>

Array of image result objects, or an empty array if none are found.
