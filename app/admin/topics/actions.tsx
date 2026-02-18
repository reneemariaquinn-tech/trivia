'use server';

// app/admin/topics/actions.ts
import { db, storage } from '@/lib/firebase';
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import sharp from 'sharp';
import { processTriviaAudio } from '../../game/triviaAudioGenerator';

/**
 * TIER 1: TOPICS (Categories)
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

// Fixed naming to match your CategoriesPage import
export async function deleteCategory(id: string) {
  await deleteDoc(doc(db, 'topics', id));
}

export async function upsertCategory(id: string | null, formData: FormData) {
  // 1. Extract values from FormData
  // We check for 'title' and 'name' to be safe, then map it to 'name'
  const name = (formData.get('name') || formData.get('title')) as string;
  const imageFile = formData.get('imageFile') as File;
  let imageUrl = formData.get('existingImageUrl') as string;

  // 2. Handle Image Upload (if you have covers for categories)
  if (imageFile && imageFile.size > 0) {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const resizedBuffer = await sharp(buffer)
      .resize({ width: 1600, height: 1000, fit: 'inside' })
      .toBuffer();
    const storageRef = ref(storage, `topic-covers/${Date.now()}-${imageFile.name}`);
    await uploadBytes(storageRef, resizedBuffer);
    imageUrl = await getDownloadURL(storageRef);
  } else if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('firebasestorage.googleapis.com')) {
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
        
        const storageRef = ref(storage, `topic-covers/imported/${Date.now()}.${ext}`);
        await uploadBytes(storageRef, resizedBuffer, { contentType });
        imageUrl = await getDownloadURL(storageRef);
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

/**
 * TIER 2: QUIZZES (Uses array-contains for topicIds)
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

export async function deleteQuiz(id: string, topicId?: string) {
  await deleteDoc(doc(db, 'quizzes', id));
}

// app/admin/topics/actions.ts

export async function upsertQuiz(id: string | null, topicId: string | null, formData: FormData) {
  // 1. Extract values from FormData
  // We look for 'name' because that's likely what your form input is named
  const title = (formData.get('name') || formData.get('title')) as string;
  const description = formData.get('description') as string;
  const imageFile = formData.get('imageFile') as File;
  let imageUrl = formData.get('existingImageUrl') as string;

  // 2. Handle Image Upload
  if (imageFile && imageFile.size > 0) {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const resizedBuffer = await sharp(buffer)
      .resize({ width: 1600, height: 1000, fit: 'inside' })
      .toBuffer();
    const storageRef = ref(storage, `quiz-covers/${Date.now()}-${imageFile.name}`);
    await uploadBytes(storageRef, resizedBuffer);
    imageUrl = await getDownloadURL(storageRef);
  } else if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('firebasestorage.googleapis.com')) {
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
        
        const storageRef = ref(storage, `quiz-covers/imported/${Date.now()}.${ext}`);
        await uploadBytes(storageRef, resizedBuffer, { contentType });
        imageUrl = await getDownloadURL(storageRef);
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

/**
 * TIER 3: QUESTIONS (Uses array-contains for quizIds)
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

export async function deleteQuestion(id: string) {
  await deleteDoc(doc(db, 'questions', id));
}

export async function bulkDeleteQuestions(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach(id => {
    batch.delete(doc(db, 'questions', id));
  });
  await batch.commit();
}

export async function bulkUpdateDifficulty(ids: string[], difficulty: string) {
  const batch = writeBatch(db);
  ids.forEach(id => {
    batch.update(doc(db, 'questions', id), { difficulty });
  });
  await batch.commit();
}

export async function upsertQuestion(questionId: string | null, quizId: string, formData: FormData) {
  const text = formData.get('text') as string;
  const difficulty = formData.get('difficulty') as string;
  const searchQuery = (formData.get('searchQuery') as string) || text.substring(0, 50);
  const orientation = formData.get('orientation') as string;
  const photographer = formData.get('imagePhotographer') as string;
  const imageSource = formData.get('imageSource') as string;

  const imageFile = formData.get('imageFile') as File;
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

  if (imageFile && imageFile.size > 0) {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const pipeline = sharp(buffer).rotate();
    const metadata = await pipeline.metadata();
    if (metadata.width && metadata.height) {
      finalOrientation = metadata.width >= metadata.height ? 'landscape' : 'portrait';
    }

    const resizedBuffer = await pipeline
      .resize({ width: 1600, height: 1000, fit: 'inside' })
      .toBuffer();

    const storageRef = ref(storage, `question-images/${Date.now()}-${imageFile.name}`);
    await uploadBytes(storageRef, resizedBuffer);
    imageUrl = await getDownloadURL(storageRef);
    isNewUpload = true;
  } else if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('firebasestorage.googleapis.com')) {
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
        const storageRef = ref(storage, `question-images/${fileName}`);
        
        await uploadBytes(storageRef, resizedBuffer, { contentType });
        imageUrl = await getDownloadURL(storageRef);
        isNewUpload = true;
      }
    } catch (error) {
      console.error("Error importing external image:", error);
    }
  }

  // 3. Handle a new audio file upload, which overwrites any 'en' URL
  const audioFile = formData.get('audioFile') as File;
  if (audioFile && audioFile.size > 0) {
    const storageRef = ref(storage, `question-audio/${Date.now()}-${audioFile.name}`);
    await uploadBytes(storageRef, audioFile);
    const audioUrl = await getDownloadURL(storageRef);
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

/**
 * PHASE 3: THE IMAGE SEARCHER (PEXELS)
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

  const storagePath = `question-images/automated/${questionId}.jpg`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, resizedBuffer, { contentType: 'image/jpeg' });
  const permanentUrl = await getDownloadURL(storageRef);

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