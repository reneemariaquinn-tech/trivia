import { NextResponse } from 'next/server';
import { processTriviaAudio } from '../../game/triviaAudioGenerator';

export async function GET() {
  try {
    console.log('Starting audio generation test...');
    
    const result = await processTriviaAudio({
      question: "What is the capital of Australia?",
      answers: ["Sydney", "Melbourne", "Canberra"]
    }, 'en'); // Testing English ('en')

    console.log('Test successful:', result);

    return NextResponse.json({ 
      success: true, 
      data: result 
    });

  } catch (error: any) {
    console.error('Test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}
