**Trivia Pro**

***

# Trivia Pro — Project Overview

A Next.js 16 admin tool for creating and managing trivia content, built for Resparke.
Content is organised in a 3-tier hierarchy and can be exported as a self-contained offline game.

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Database | Firebase Firestore — named database `trivia` |
| Storage | Firebase Storage — `resparke-hub.firebasestorage.app` |
| Styling | Tailwind CSS v4 |
| AI / Audio | Google Cloud TTS, Google Translate, Genkit + Gemini |
| Image Search | Pexels API, Wikimedia Commons |
| Deployment | Firebase App Hosting (Cloud Run) + Firebase Cloud Functions |

---

## Data Model

```
topics/                       ← Categories (Tier 1)
  {topicId}
    name: string
    imageUrl: string

quizzes/                      ← Quizzes (Tier 2)
  {quizId}
    title: string
    imageUrl: string
    topicIds: string[]        ← links to parent topic(s)

questions/                    ← Questions (Tier 3)
  {questionId}
    text: string
    difficulty: 'easy' | 'medium' | 'hard'
    answers: { text: string; isCorrect: boolean }[]
    imageUrl: string
    audioUrls: { en: string; [lang: string]: string }
    imageMeta: { orientation: 'landscape' | 'portrait'; photographer: string; source: string }
    quizIds: string[]         ← links to parent quiz(es)
```

---

## Features

### Topics (Categories)
Manage the top-level categories that group quizzes. Each topic can have a cover image
sourced from Pexels, Wikimedia Commons, or a direct upload.

**Server Actions:** `getCategories`, `upsertCategory`, `deleteCategory`

---

### Quizzes
Manage quiz sets within a category. A quiz can belong to multiple topics.
Cover images follow the same pipeline as topic images.

**Server Actions:** `getQuizzes`, `upsertQuiz`, `deleteQuiz`

---

### Questions
Manage individual trivia questions within a quiz. Questions support:

- 3 answer options with one marked correct
- Difficulty levels: Easy / Medium / Hard
- A cover image with orientation metadata (landscape / portrait)
- TTS-generated audio in one or more languages

**Server Actions:** `getQuestions`, `upsertQuestion`, `deleteQuestion`,
`bulkDeleteQuestions`, `bulkUpdateDifficulty`, `bulkUploadQuestions`

---

### AI Image Search
Find and assign images to questions or quizzes from two providers:

- **Pexels** — high-quality stock photography (requires `PEXELS_API_KEY`)
- **Wikimedia Commons** — free-use media

Images are always downloaded, resized server-side (max 1600×1000px via Sharp), and
stored in Firebase Storage before the URL is saved to Firestore.

**Server Actions:** `autoAssignImage` (bulk auto-assign), `searchImages` (manual search modal)

---

### Text-to-Speech Audio
Generate narrated audio for any question using Google Cloud TTS. The audio script
reads the question twice then lists answers A, B, C with pauses between each — designed
for group trivia sessions where participants need time to think.

Supports multiple languages via Google Translate. English uses the
`en-AU-Standard-C` voice at 0.75× speed.

**Server Action:** `generateQuestionAudioWithTTS`
**Pipeline module:** `processTriviaAudio` (in `triviaAudioGenerator.ts`)

---

### Game Export (ZIP)
Export any quiz as a self-contained ZIP file containing:
- `index.html` — full game UI built with Tailwind CDN + Poppins
- `style.css` — custom styles
- `script.js` — vanilla JS game logic
- `assets/` — all images and audio files bundled locally

Three game modes are supported in the exported game:
| Mode | Description |
|---|---|
| Play | Audio guides the session; participants tap to advance |
| Quiet | No audio; participants read questions themselves |
| Auto | Fully automatic; reveals answers after each audio clip |

**Cloud Function:** `exportGameZip` (deployed at `us-central1-resparke-hub.cloudfunctions.net`)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PEXELS_API_KEY` | Yes | Pexels image search API key (set as Firebase secret) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes* | JSON service account for TTS, Translate, Storage |
| `GOOGLE_CLIENT_EMAIL` | Yes* | Alternative to above (individual credential fields) |
| `GOOGLE_PRIVATE_KEY` | Yes* | Alternative to above |
| `GOOGLE_PROJECT_ID` | Yes* | Alternative to above |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | No | Defaults to `resparke-hub.firebasestorage.app` |
| `GOOGLE_GENAI_API_KEY` | For AI features | Gemini API key for Genkit flows |

*One of `GOOGLE_SERVICE_ACCOUNT_KEY` or the three individual fields is required for audio generation.

---

## Regenerating This Documentation

```bash
npm run docs
```

Output is written to `docs/api/`. Re-run whenever server actions or types change.
