'use client';

import { useState } from 'react';
import { generateQuestionAudio } from './actions';

export default function TestPage() {
  const [questionId, setQuestionId] = useState('');
  const [language, setLanguage] = useState('Spanish');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [audioUrl, setAudioUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleTest = async () => {
    if (!questionId) return alert('Please enter a Question ID from your Firestore');
    
    setStatus('loading');
    setErrorMsg('');
    
    const result = await generateQuestionAudio(questionId, language);
    
    if (result.success && result.audioUrl) {
      setAudioUrl(result.audioUrl);
      setStatus('success');
    } else {
      setErrorMsg(result.error || 'Unknown error occurred');
      setStatus('error');
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-slate-900 text-white">
      <h1 className="text-3xl font-bold mb-8">AI Audio Tester 2026</h1>
      
      <div className="bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Question ID (from Firestore)</label>
          <input 
            type="text" 
            value={questionId}
            onChange={(e) => setQuestionId(e.target.value)}
            placeholder="e.g. q123_history"
            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Target Language</label>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full p-2 rounded bg-slate-700 border border-slate-600 outline-none"
          >
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Japanese">Japanese</option>
          </select>
        </div>

        <button 
          onClick={handleTest}
          disabled={status === 'loading'}
          className={`w-full py-3 rounded-lg font-bold transition-all ${
            status === 'loading' ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {status === 'loading' ? 'AI is Thinking...' : 'Generate & Save Audio'}
        </button>

        {status === 'success' && (
          <div className="mt-4 p-4 bg-green-900/30 border border-green-500 rounded-lg">
            <p className="text-green-400 text-sm mb-2 font-medium">✓ Audio Generated Successfully!</p>
            <audio src={audioUrl} controls className="w-full" />
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
            Error: {errorMsg}
          </div>
        )}
      </div>
    </main>
  );
}