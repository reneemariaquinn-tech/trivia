'use server';

import { z } from 'zod';
import { ai } from '@/lib/genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection } from 'firebase/firestore';
import { processTriviaAudio } from './game/triviaAudioGenerator';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

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
    const fileName = `trivia/audio/${questionId}_${language}.mp3`;
    const bucket = adminStorage.bucket();
    const file = bucket.file(fileName);
    const token = uuidv4();
    
    await file.save(audioBuffer, {
      metadata: { contentType: 'audio/mp3', metadata: { firebaseStorageDownloadTokens: token } }
    });

    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;

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

export async function searchImages(query: string, provider: 'pexels' | 'wikimedia') {
  try {
    if (provider === 'pexels') {
      if (!process.env.PEXELS_API_KEY) {
        console.warn('Pexels API Key missing');
        return [];
      }
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`, {
        headers: { Authorization: process.env.PEXELS_API_KEY }
      });
      const data = await res.json();
      if (!data.photos) return [];
      
      return data.photos.map((p: any) => ({
        url: p.src.large2x || p.src.large,
        photographer: p.photographer,
        source: 'Pexels'
      }));
    } 
    
    if (provider === 'wikimedia') {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrnamespace: '6', // File namespace
        gsrlimit: '6',
        gsrsearch: query,
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|user|size',
        iiurlwidth: '1880',
        origin: '*'
      });
      
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
      const data = await res.json();
      if (!data.query || !data.query.pages) return [];
      
      return Object.values(data.query.pages).map((p: any) => {
        const info = p.imageinfo?.[0];
        if (!info) return null;

        let imageUrl = info.thumburl || info.url;

        // Optimize for portrait: max 1000px wide
        if (info.height && info.width && info.height > info.width) {
          imageUrl = imageUrl.replace(/\/(\d+)px-/, (match: string, width: string) => {
            return parseInt(width) > 1000 ? '/1000px-' : match;
          });
        }

        return {
          url: imageUrl,
          photographer: info?.user || 'Wikimedia Commons',
          source: 'Wikimedia Commons'
        };
      }).filter((img: any) => img && img.url);
    }

    return [];
  } catch (e) {
    console.error('Image search failed:', e);
    return [];
  }
}