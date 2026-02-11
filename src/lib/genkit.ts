import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI() // The SDK now handles the key automatically from your .env
  ],
  model: 'googleai/gemini-3-flash', 
});