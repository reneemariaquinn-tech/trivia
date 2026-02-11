'use server';

import { z } from 'zod';
import { ai } from '@/lib/genkit';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { processTriviaAudio } from './game/triviaAudioGenerator';

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

export async function generateQuestionAudioWithTTS(questionId: string, language: string) {
  try {
    // 1. Fetch question data
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
      answers: questionData.answers.map((ans: { text: string }) => ans.text)
    };

    // 2. Generate Audio using the custom TTS generator
    const result = await processTriviaAudio(triviaInput, language);

    if (!result || !result.audioUrl) {
      throw new Error('Failed to generate audio or get URL');
    }

    // 3. Update the question document
    await updateDoc(docRef, {
      [`audioUrls.${language}`]: result.audioUrl,
      [`translations.${language}`]: result.translatedText,
    });

    return { success: true, audioUrl: result.audioUrl };
  } catch (error) {
    console.error('Error in generateQuestionAudioWithTTS:', error);
    return { success: false, error: (error as Error).message };
  }
}