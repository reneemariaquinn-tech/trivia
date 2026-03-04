/**
 * @packageDocumentation
 * Server actions for managing the full trivia content hierarchy.
 *
 * All functions run server-side via Next.js Server Actions and interact with
 * the `trivia` Firestore database within the `resparke-hub` Firebase project.
 *
 * **Data model:**
 * - **Topics** (categories) → `topics` collection
 * - **Quizzes** → `quizzes` collection, linked to topics via `topicIds: string[]`
 * - **Questions** → `questions` collection, linked to quizzes via `quizIds: string[]`
 *
 * Images sourced from Pexels or Wikimedia are downloaded, resized to max 1600×1000px,
 * and stored in Firebase Storage under the `trivia/` prefix before being saved to Firestore.
 */
'use server';

// app/admin/topics/actions.ts
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  writeBatch, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query, 
  where,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import sharp from 'sharp';
import { processTriviaAudio } from '../../game/triviaAudioGenerator';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// ─── TIER 1: TOPICS ──────────────────────────────────────────────────────────

/**
 * Retrieves all topics (categories) with a live quiz count for each.
 *
 * Fetches all quizzes in a single pass and counts how many reference each topic
 * via their `topicIds` array, avoiding N+1 queries.
 *
 * @group Topics
 * @returns Array of topic objects including `id`, `name`, `imageUrl`, `quizCount`,
 *   `createdAt`, and `updatedAt` (ISO strings).
 */
export async function getCategories() {
  // 1. Get all topics
  const topicsSnapshot = await getDocs(collection(db, 'topics'));
  
  // 2. Get all quizzes once (more efficient than querying inside a loop)
  const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
  const allQuizzes = quizzesSnapshot.docs.map(doc => doc.data());

  return topicsSnapshot.docs.map(doc => {
    const data = doc.data();
    const topicId = doc.id;

    // 3. Filter quizzes that include this topicId in their array
    const count = allQuizzes.filter(quiz => 
      quiz.topicIds && Array.isArray(quiz.topicIds) && quiz.topicIds.includes(topicId)
    ).length;

    return {
      id: topicId,
      ...data,
      name: data.name || data.title || "Untitled Topic",
      imageUrl: data.imageUrl || "",
      quizCount: count, // This provides the number for your UI
      createdAt: data.createdAt?.toDate?.().toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
    };
  });
}

/**
 * Permanently deletes a topic/category from Firestore.
 *
 * @group Topics
 * @param id - Firestore document ID of the topic to delete.
 */
export async function deleteCategory(id: string) {
  await deleteDoc(doc(db, 'topics', id));
}

/**
 * Creates or updates a topic/category.
 *
 * If the provided image URL is an external HTTP source (i.e. from an AI image search),
 * it is fetched, resized to a max of 1600×1000px via Sharp, and stored in Firebase Storage
 * at `trivia/topic-covers/imported/`. A persistent download URL is then saved to Firestore.
 *
 * @group Topics
 * @param id - Existing topic ID to update, or `null` to create a new topic.
 * @param formData - Form fields:
 *   - `name` / `title` — display name of the category
 *   - `existingImageUrl` — current image URL (Firebase Storage or external)
 */
export async function upsertCategory(id: string | null, formData: FormData) {
  // 1. Extract values from FormData
  // We check for 'title' and 'name' to be safe, then map it to 'name'
  const name = (formData.get('name') || formData.get('title')) as string;
  let imageUrl = formData.get('existingImageUrl') as string;

  // 2. Handle External Image Import (AI Search result)
  if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('firebasestorage.googleapis.com')) {
    // Handle external image (AI Search result) - Download and save to Storage
    try {
      const response = await fetch(imageUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const resizedBuffer = await sharp(buffer)
          .resize({ width: 1600, height: 1000, fit: 'inside' })
          .toBuffer();
          
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        let ext = contentType.split('/')[1] || 'jpg';
        if (ext === 'jpeg') ext = 'jpg';
        
        const fileName = `trivia/topic-covers/imported/${Date.now()}.${ext}`;
        const bucket = adminStorage.bucket();
        const file = bucket.file(fileName);
        const token = uuidv4();

        await file.save(resizedBuffer, {
          metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } }
        });

        // Construct public URL manually
        imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
      }
    } catch (error) {
      console.error("Error importing external category image:", error);
    }
  }

  // 3. Prepare Topic-specific data
  const topicData = {
    name: name || "Untitled Topic", // Standardizing to 'name'
    imageUrl: imageUrl || "",
    updatedAt: serverTimestamp(),
  };

  // 4. Save to Firestore
  if (id && id !== 'null') {
    await updateDoc(doc(db, 'topics', id), topicData);
  } else {
    await addDoc(collection(db, 'topics'), {
      ...topicData,
      createdAt: serverTimestamp(),
    });
  }
}

// ─── TIER 2: QUIZZES ─────────────────────────────────────────────────────────

/**
 * Retrieves all quizzes belonging to a topic, with a live question count for each.
 *
 * Fetches all questions in a single pass and counts how many reference each quiz
 * via their `quizIds` array. Also returns the parent topic's name for the page header.
 *
 * @group Quizzes
 * @param topicId - Firestore document ID of the parent topic.
 * @returns Object containing `quizzes` (array), `topicTitle`, and `categoryName`.
 */
export async function getQuizzes(topicId: string) {
  // 1. Get Quizzes for this topic
  const quizQuery = query(collection(db, 'quizzes'), where('topicIds', 'array-contains', topicId));
  const quizSnapshot = await getDocs(quizQuery);
  
  // 2. Get ALL questions to calculate counts
  const questionsSnapshot = await getDocs(collection(db, 'questions'));
  const allQuestions = questionsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  const quizzes = quizSnapshot.docs.map(doc => {
    const data = doc.data();
    const quizId = doc.id;

    // 3. Count questions where the 'quizIds' array contains this quiz's ID
    const qCount = allQuestions.filter(q => {
      const qData = q as any;
      // Defensive check: ensure quizIds exists and is an array
      return qData.quizIds && 
             Array.isArray(qData.quizIds) && 
             qData.quizIds.includes(quizId);
    }).length;

    return {
      id: quizId,
      ...data,
      title: data.title || data.name || "Untitled Quiz",
      description: data.description || "No description provided.",
      // Check both possible image field names
      imageUrl: data.imageUrl || data.coverImageUrl || "",
      questionCount: qCount,
      createdAt: data.createdAt?.toDate?.().toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
    };
  });

  // 4. Get the Topic Name for the header
  const topicDoc = await getDoc(doc(db, 'topics', topicId));
  const topicName = topicDoc.exists() ? (topicDoc.data().name || "Topic") : "Topic";

  return { 
    quizzes, 
    topicTitle: topicName,
    categoryName: topicName 
  };
}

/**
 * Permanently deletes a quiz from Firestore.
 *
 * @group Quizzes
 * @param id - Firestore document ID of the quiz to delete.
 */
export async function deleteQuiz(id: string) {
  await deleteDoc(doc(db, 'quizzes', id));
}

/**
 * Creates or updates a quiz.
 *
 * On create, the quiz is linked to `topicId` via the `topicIds` array.
 * On update, `topicId` (if provided) is merged into the existing `topicIds` array via `arrayUnion`,
 * preserving any existing topic relationships.
 *
 * External images (from AI search) are downloaded, resized, and stored at `trivia/quiz-covers/imported/`.
 *
 * @group Quizzes
 * @param id - Existing quiz ID to update, or `null` to create a new quiz.
 * @param topicId - Parent topic ID. Required when creating; optional when updating.
 * @param formData - Form fields:
 *   - `name` / `title` — quiz title
 *   - `description` — optional description
 *   - `existingImageUrl` — current cover image URL (Firebase Storage or external)
 */
export async function upsertQuiz(id: string | null, topicId: string | null, formData: FormData) {
  // 1. Extract values from FormData
  // We look for 'name' because that's likely what your form input is named
  const title = (formData.get('name') || formData.get('title')) as string;
  const description = formData.get('description') as string;
  let imageUrl = formData.get('existingImageUrl') as string;

  // 2. Handle External Image Import
  if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('firebasestorage.googleapis.com')) {
    // Handle external image (AI Search result) - Download and save to Storage
    try {
      const response = await fetch(imageUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const resizedBuffer = await sharp(buffer)
          .resize({ width: 1600, height: 1000, fit: 'inside' })
          .toBuffer();
          
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        let ext = contentType.split('/')[1] || 'jpg';
        if (ext === 'jpeg') ext = 'jpg';
        
        const fileName = `trivia/quiz-covers/imported/${Date.now()}.${ext}`;
        const bucket = adminStorage.bucket();
        const file = bucket.file(fileName);
        const token = uuidv4();

        await file.save(resizedBuffer, {
          metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } }
        });

        // Construct public URL manually
        imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
      }
    } catch (error) {
      console.error("Error importing external quiz image:", error);
    }
  }

  // 3. Prepare the standardized data object
  const commonData = {
    title: title || "Untitled Quiz", // This ensures it saves as 'title' in Firestore
    description: description || "",
    imageUrl: imageUrl || "",
    updatedAt: serverTimestamp(),
  };

  // 4. Save to Firestore
  if (id && id !== 'null') {
    const quizRef = doc(db, 'quizzes', id);
    const updateData: any = { ...commonData };
    if (topicId) {
      updateData.topicIds = arrayUnion(topicId);
    }
    await updateDoc(quizRef, updateData);
  } else {
    if (!topicId) throw new Error("Topic ID is required for new quizzes");
    await addDoc(collection(db, 'quizzes'), {
      ...commonData,
      createdAt: serverTimestamp(),
      topicIds: [topicId] // Initial link to the current topic
    });
  }
}

// ─── TIER 3: QUESTIONS ───────────────────────────────────────────────────────

/**
 * Retrieves all questions for a quiz, along with the parent quiz document.
 *
 * Firestore `Timestamp` values in `imageMeta` are safely serialised to ISO strings
 * so they can be passed across the server/client boundary.
 *
 * @group Questions
 * @param quizId - Firestore document ID of the quiz.
 * @returns Object with `questions` (array) and `quiz` (the parent quiz document or `null`).
 */
export async function getQuestions(quizId: string) {
  const q = query(collection(db, 'questions'), where('quizIds', 'array-contains', quizId));
  const snapshot = await getDocs(q);
  
  const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
  let quiz = null;

  if (quizDoc.exists()) {
    const data = quizDoc.data();
    quiz = {
      id: quizDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
    };
  }

  return { 
    questions: snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Sanitize nested Timestamps in imageMeta
      let imageMeta = data.imageMeta;
      if (imageMeta) {
        imageMeta = { ...imageMeta };
        if (imageMeta.updatedAt) {
          if (typeof imageMeta.updatedAt.toDate === 'function') {
            imageMeta.updatedAt = imageMeta.updatedAt.toDate().toISOString();
          } else if (imageMeta.updatedAt instanceof Date) {
            imageMeta.updatedAt = imageMeta.updatedAt.toISOString();
          } else if (typeof imageMeta.updatedAt === 'object') {
            // Handle plain object timestamp or nullify to prevent crash
            imageMeta.updatedAt = typeof imageMeta.updatedAt.seconds === 'number' ? new Date(imageMeta.updatedAt.seconds * 1000).toISOString() : null;
          }
          // Final safety check: if it's still an object (e.g. Timestamp) and not null, force null
          if (imageMeta.updatedAt && typeof imageMeta.updatedAt === 'object') {
            imageMeta.updatedAt = null;
          }
        }
      }

      return { 
        id: doc.id, 
        ...data,
        imageMeta,
        createdAt: data.createdAt?.toDate?.().toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
      };
    }), 
    quiz 
  };
}

/**
 * Permanently deletes a single question from Firestore.
 *
 * @group Questions
 * @param id - Firestore document ID of the question to delete.
 */
export async function deleteQuestion(id: string) {
  await deleteDoc(doc(db, 'questions', id));
}

/**
 * Deletes multiple questions in a single Firestore batch operation.
 *
 * @group Questions
 * @param ids - Array of Firestore document IDs to delete.
 */
export async function bulkDeleteQuestions(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach(id => {
    batch.delete(doc(db, 'questions', id));
  });
  await batch.commit();
}

/**
 * Sets the difficulty level for multiple questions in a single Firestore batch operation.
 *
 * @group Questions
 * @param ids - Array of Firestore document IDs to update.
 * @param difficulty - Target difficulty level: `'easy'`, `'medium'`, or `'hard'`.
 */
export async function bulkUpdateDifficulty(ids: string[], difficulty: string) {
  const batch = writeBatch(db);
  ids.forEach(id => {
    batch.update(doc(db, 'questions', id), { difficulty });
  });
  await batch.commit();
}

/**
 * Creates or updates a question, handling image and audio asset management.
 *
 * **Image handling:** If the image URL is an external source (Pexels / Wikimedia),
 * it is fetched server-side, auto-rotated, resized to max 1600×1000px, and stored
 * in Firebase Storage at `trivia/question-images/imported/`. Orientation (`landscape`
 * or `portrait`) is detected from the image dimensions and saved to `imageMeta`.
 *
 * **Audio handling:** Existing `audioUrls` for other languages are preserved.
 * A new audio file upload via `audioFile` form field overwrites the English (`en`) entry.
 *
 * @group Questions
 * @param questionId - Existing question ID to update, or `null` to create a new question.
 * @param quizId - Parent quiz ID. Used to set `quizIds` on new questions.
 * @param formData - Form fields:
 *   - `text` — question text
 *   - `difficulty` — `'easy'`, `'medium'`, or `'hard'`
 *   - `opt0`, `opt1`, `opt2` — answer option texts
 *   - `correctIndex` — `'0'`, `'1'`, or `'2'` (index of the correct answer)
 *   - `existingImageUrl` — current image URL (Firebase Storage or external)
 *   - `orientation` — manual override: `'landscape'` or `'portrait'`
 *   - `imagePhotographer` — attribution name (saved to `imageMeta`)
 *   - `imageSource` — attribution source (e.g. `'Pexels'`)
 *   - `audioFile` — optional new audio file (overwrites `audioUrls.en`)
 *   - `existingAudioUrl` — current English audio URL to preserve
 * @returns The saved question data including its Firestore `id`.
 */
export async function upsertQuestion(questionId: string | null, quizId: string, formData: FormData) {
  const text = formData.get('text') as string;
  const difficulty = formData.get('difficulty') as string;
  const searchQuery = (formData.get('searchQuery') as string) || text.substring(0, 50);
  const orientation = formData.get('orientation') as string;
  const photographer = formData.get('imagePhotographer') as string;
  const imageSource = formData.get('imageSource') as string;

  let imageUrl = formData.get('existingImageUrl') as string;
  let isNewUpload = false;
  let finalOrientation = orientation || 'landscape';

  // --- AUDIO HANDLING ---
  let audioUrls: any = {};

  // 1. If updating, load existing audio URLs to preserve other languages
  if (questionId) {
    const existingDoc = await getDoc(doc(db, 'questions', questionId));
    if (existingDoc.exists()) {
      audioUrls = existingDoc.data().audioUrls || {};
    }
  }

  // 2. Check for an audio URL from the client (could be existing or newly generated)
  const existingAudioUrl = formData.get('existingAudioUrl');
  if (typeof existingAudioUrl === 'string') {
    // Best Practice: Validate URL to prevent accidental unlinking via "undefined" or empty strings
    if (existingAudioUrl.trim().startsWith('http')) {
      audioUrls.en = existingAudioUrl.trim();
    }
  }

  // Check if client uploaded a new image (passed as URL now)
  // We detect "new upload" if the URL changed or if we have a flag, 
  // but for simplicity, if imageUrl is different from existing, we assume new.
  // However, the client logic below handles the upload.
  
  if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('firebasestorage.googleapis.com')) {
    // NEW: Import external images (Wikimedia/Pexels) to Firebase Storage
    try {
      const response = await fetch(imageUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const pipeline = sharp(buffer).rotate();
        const metadata = await pipeline.metadata();
        if (metadata.width && metadata.height) {
          finalOrientation = metadata.width >= metadata.height ? 'landscape' : 'portrait';
        }

        const resizedBuffer = await pipeline
          .resize({ width: 1600, height: 1000, fit: 'inside' })
          .toBuffer();
        
        // Determine extension/type
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        if (contentType.includes('gif')) ext = 'gif';
        if (contentType.includes('webp')) ext = 'webp';
        
        const fileName = `imported/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const bucket = adminStorage.bucket();
        const file = bucket.file(`trivia/question-images/${fileName}`);
        const token = uuidv4();
        
        await file.save(resizedBuffer, {
          metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } }
        });

        imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(`trivia/question-images/${fileName}`)}?alt=media&token=${token}`;
        isNewUpload = true;
      }
    } catch (error) {
      console.error("Error importing external image:", error);
    }
  }

  // 3. Handle a new audio file upload, which overwrites any 'en' URL
  const audioFile = formData.get('audioFile') as File;
  if (audioFile && audioFile.size > 0) {
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const fileName = `trivia/question-audio/${Date.now()}-${audioFile.name}`;
    const bucket = adminStorage.bucket();
    const file = bucket.file(fileName);
    const token = uuidv4();

    await file.save(buffer, {
      metadata: { contentType: audioFile.type || 'audio/mpeg', metadata: { firebaseStorageDownloadTokens: token } }
    });
    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
    audioUrls.en = audioUrl;
  }

  const questionData: any = {
    text,
    difficulty,
    searchQuery,
    imageUrl: imageUrl || "",
    audioUrls: Object.keys(audioUrls).length > 0 ? audioUrls : null,
    updatedAt: new Date(),
    answers: [
      { text: formData.get('opt0'), isCorrect: formData.get('correctIndex') === '0' },
      { text: formData.get('opt1'), isCorrect: formData.get('correctIndex') === '1' },
      { text: formData.get('opt2'), isCorrect: formData.get('correctIndex') === '2' },
    ]
  };

  // Ensure metadata is accurate:
  // 1. If new manual upload, clear old Pexels meta and set source to manual
  // 2. If image removed, clear all meta
  if (isNewUpload) {
    questionData.imageMeta = {
      orientation: finalOrientation,
      photographer: photographer || null,
      source: imageSource || null
    };
    questionData.imageSource = imageSource || 'manual';
    questionData.imageStatus = 'ready';
  } else if (!imageUrl) {
    questionData.imageMeta = null;
    questionData.imageSource = null;
    questionData.imageStatus = 'pending';
  }

  let finalId = questionId;

  if (questionId) {
    await updateDoc(doc(db, 'questions', questionId), questionData);
  } else {
    questionData.quizIds = [quizId];
    const docRef = await addDoc(collection(db, 'questions'), questionData);
    finalId = docRef.id;
  }

  return {
    id: finalId,
    ...questionData,
    updatedAt: questionData.updatedAt.toISOString()
  };
}

/**
 * Bulk-imports questions from a JSON string (parsed from CSV in the UI).
 *
 * Splits large imports into chunks of 450 to stay within Firestore's 500-operation
 * batch limit. Each question is created with `imageStatus: 'pending'` so images
 * can be assigned later via the AI image search bulk action.
 *
 * **Expected CSV column order:** `question, option1, option2, option3, correctIndex, difficulty`
 * where `correctIndex` is 1-based (`1`, `2`, or `3`).
 *
 * @group Questions
 * @param quizId - Firestore document ID of the quiz to import into.
 * @param jsonData - JSON-stringified array of question objects.
 * @returns `{ success: true, count: number }` with the total number of questions created.
 */
export async function bulkUploadQuestions(quizId: string, jsonData: string) {
  const questions = JSON.parse(jsonData);
  
  // Firestore batch limit is 500 operations. We chunk to be safe.
  const chunkSize = 450; 
  const chunks = [];
  
  for (let i = 0; i < questions.length; i += chunkSize) {
    chunks.push(questions.slice(i, i + chunkSize));
  }

  let totalCount = 0;

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    
    chunk.forEach((q: any) => {
      const docRef = doc(collection(db, 'questions'));
      // Assume correctIndex is 1-based (1, 2, 3) from the CSV
      const correctIdx = parseInt(String(q.correctIndex).trim());
      
      batch.set(docRef, {
        text: q.question,
        difficulty: (q.difficulty || 'medium').toLowerCase(),
        searchQuery: (q.question || "").substring(0, 50),
        quizIds: [quizId],
        answers: [
          { text: q.option1 || "", isCorrect: correctIdx === 1 },
          { text: q.option2 || "", isCorrect: correctIdx === 2 },
          { text: q.option3 || "", isCorrect: correctIdx === 3 },
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        imageUrl: "",
        imageStatus: 'pending'
      });
    });
    
    await batch.commit();
    totalCount += chunk.length;
  }
  
  return { success: true, count: totalCount };
}

// ─── IMAGES ──────────────────────────────────────────────────────────────────

/**
 * Automatically finds and assigns an image to a question using the Pexels API.
 *
 * Searches Pexels for the given query (landscape orientation), downloads the top result,
 * resizes it to max 1600×1000px, and stores it in Firebase Storage at
 * `trivia/question-images/automated/{questionId}.jpg`. The question document is updated
 * with the new `imageUrl`, `imageStatus: 'found'`, and full `imageMeta` (photographer,
 * dimensions, aspect ratio, orientation).
 *
 * @group Images
 * @param questionId - Firestore document ID of the question to update.
 * @param searchQuery - Search term used to find a relevant image (defaults to question text).
 * @returns The updated image fields: `imageUrl`, `imageStatus`, `imageSource`, `imageMeta`.
 * @throws Error if `PEXELS_API_KEY` is missing or no image is found for the query.
 */
export async function autoAssignImage(questionId: string, searchQuery: string) {
  const API_KEY = process.env.PEXELS_API_KEY;
  if (!API_KEY) throw new Error("PEXELS_API_KEY is missing");

  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`;
  const res = await fetch(searchUrl, { headers: { Authorization: API_KEY } });
  const data = await res.json();

  if (!data.photos?.length) throw new Error("No image found");

  const photo = data.photos[0];
  const imageRes = await fetch(photo.src.large2x);
  const buffer = Buffer.from(await imageRes.arrayBuffer());
  const resizedBuffer = await sharp(buffer)
    .resize({ width: 1600, height: 1000, fit: 'inside' })
    .toBuffer();

  const storagePath = `trivia/question-images/automated/${questionId}.jpg`;
  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);
  const token = uuidv4();

  await file.save(resizedBuffer, {
    metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: token } }
  });

  const permanentUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

  const now = new Date();
  const ratio = parseFloat((photo.width / photo.height).toFixed(2));
  
  const imageMeta = {
      provider: 'pexels',
      photographer: photo.photographer || null,
      width: photo.width,
      height: photo.height,
      aspectRatio: ratio,
      orientation: ratio >= 1.0 ? 'landscape' : 'portrait',
      updatedAt: now
  };

  const updateData = {
    imageUrl: permanentUrl,
    imageStatus: 'found',
    imageSource: 'pexels',
    imageMeta: imageMeta
  };

  await updateDoc(doc(db, 'questions', questionId), updateData);
  
  return {
    imageUrl: permanentUrl,
    imageStatus: 'found',
    imageSource: 'pexels',
    imageMeta: {
      ...imageMeta,
      updatedAt: now.toISOString()
    }
  };
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

/**
 * One-time migration utility: backfills `orientation` and `aspectRatio` onto question
 * documents that have `imageMeta.width` but are missing the orientation field.
 *
 * Safe to run multiple times — only updates documents that need it.
 *
 * @group Utilities
 * @returns The number of documents updated.
 */
export async function migrateQuestionMetadata() {
  const snapshot = await getDocs(collection(db, 'questions'));
  const batch = writeBatch(db);
  let count = 0;
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.imageMeta?.width && !data.imageMeta.orientation) {
      const ratio = parseFloat((data.imageMeta.width / data.imageMeta.height).toFixed(2));
      batch.update(docSnap.ref, { 
        'imageMeta.orientation': ratio >= 1.0 ? 'landscape' : 'portrait',
        'imageMeta.aspectRatio': ratio 
      });
      count++;
    }
  });
  if (count > 0) await batch.commit();
  return count;
}

// ─── AUDIO ───────────────────────────────────────────────────────────────────

/**
 * Generates a TTS (Text-to-Speech) audio file for a question and saves it to Firestore.
 *
 * Fetches the question text and answers, passes them to {@link processTriviaAudio} which:
 * - Optionally translates the content (skipped for `'en'`)
 * - Builds an SSML script: question → 2s pause → question repeat → 1.5s pause → answers A/B/C
 * - Synthesises audio using Google Cloud TTS (English: `en-AU-Standard-C` at 0.75× speed)
 * - Uploads the MP3 to Firebase Storage at `trivia/question-tts/`
 *
 * The resulting URL is saved to `audioUrls.{language}` on the question document.
 * A 30-second timeout prevents the action from hanging on slow API responses.
 *
 * @group Audio
 * @param questionId - Firestore document ID of the question.
 * @param language - BCP-47 language code, e.g. `'en'`, `'fr'`, `'es'`.
 * @returns `{ success: true, audioUrl }` on success, or `{ success: false, error }` on failure.
 */
export async function generateQuestionAudioWithTTS(questionId: string, language: string) {
  try {
    const docRef = doc(db, 'questions', questionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Question document not found');
    }
    
    const questionData = docSnap.data();
    if (!questionData.text || !Array.isArray(questionData.answers)) {
      throw new Error('Invalid question data format.');
    }
    
    const triviaInput = {
      question: questionData.text,
      answers: questionData.answers.map((ans: any) => ans.text)
    };

    // Add a timeout to prevent infinite hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Audio generation timed out after 30s")), 30000)
    );

    const result: any = await Promise.race([
      processTriviaAudio(triviaInput, language),
      timeoutPromise
    ]);
    
    if (!result || !result.audioUrl) {
      throw new Error('Failed to generate audio or get URL');
    }
    
    await updateDoc(docRef, {
      [`audioUrls.${language}`]: result.audioUrl,
      [`translations.${language}`]: result.translatedText
    });
    
    return { success: true, audioUrl: result.audioUrl };
  } catch (error: any) {
    console.error('Error in generateQuestionAudioWithTTS:', error);
    return { success: false, error: error.message || "Unknown error" };
  }
}