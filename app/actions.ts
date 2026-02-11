'use server';

import { z } from 'zod';
import { ai } from '@/lib/genkit';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function generateQuestionAudio(questionId: string, language: string) {
  try {
    // 1. Correct Collection: 'questions'
    const docRef = doc(db, 'questions', questionId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error('Question document not found in "questions" collection');
    const questionData = docSnap.data();

    // 2. Generate Audio with Gemini 3
    const response = await ai.generate({
      prompt: `Translate the following trivia question to ${language} and generate the audio for it: "${questionData.text}"`,
      output: {
        // 'as any' bypasses the Zod version mismatch error
        schema: z.object({
          translatedText: z.string(),
          audioBase64: z.string(),
        }) as any
      }
    });

    const result = response.output;
    if (!result) throw new Error('AI failed to generate content');

    // 3. Upload to Storage
    const audioBuffer = Buffer.from(result.audioBase64, 'base64');
    const storageRef = ref(storage, `audio/${questionId}_${language}.mp3`);
    
    await uploadBytes(storageRef, audioBuffer, { contentType: 'audio/mp3' });
    const audioUrl = await getDownloadURL(storageRef);

    // 4. Update the question document with the new URL
    await updateDoc(docRef, {
      [`audioUrls.${language}`]: audioUrl,
      [`translations.${language}`]: result.translatedText
    });

    return { success: true, audioUrl, text: result.translatedText };
  } catch (error) {
    console.error('Action Error:', error);
    return { success: false, error: (error as Error).message };
  }
}