'use client';

import { useEffect, useState, use as useReact } from 'react';
import { 
  getQuestions, 
  upsertQuestion, 
  upsertQuiz,
  bulkDeleteQuestions, 
  bulkUpdateDifficulty,
  bulkUploadQuestions,
  autoAssignImage,
  generateQuestionAudioWithTTS
} from '../../topics/actions';
import ModalConfirm from '@/components/ModalConfirm';
import { searchImages } from '../../../actions';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function QuestionsPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = useReact(params);
  const [questions, setQuestions] = useState<any[]>([]);
  const [quiz, setQuiz] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [deleteConfig, setDeleteConfig] = useState<{ isOpen: boolean; ids: string[] }>({ isOpen: false, ids: [] });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isQuizDrawerOpen, setIsQuizDrawerOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [aiSearchModal, setAiSearchModal] = useState<{
    isOpen: boolean;
    query: string;
    results: any[];
    provider: 'pexels' | 'wikimedia';
    isSearching: boolean;
    target: 'question' | 'quiz';
  }>({ isOpen: false, query: '', results: [], provider: 'pexels', isSearching: false, target: 'question' });
  const [manualOrientation, setManualOrientation] = useState<string>('landscape');
  
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterImage, setFilterImage] = useState<string>('all');
  const [filterAudio, setFilterAudio] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { if (quizId) loadData(); }, [quizId]);

  const loadData = async () => {
    const { questions, quiz } = await getQuestions(quizId);
    setQuestions(questions);
    setQuiz(quiz);
    setIsLoading(false);
  };

  const filteredQuestions = questions.filter(q => {
    if (filterLevel !== 'all' && (q.difficulty || 'medium') !== filterLevel) return false;
    if (filterImage === 'has-image' && !q.imageUrl) return false;
    if (filterImage === 'no-image' && q.imageUrl) return false;
    if (filterAudio === 'has-audio' && !q.audioUrl) return false;
    if (filterAudio === 'no-audio' && q.audioUrl) return false;
    if (searchTerm && !(q.text || "").toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleBulkAiSearch = async () => {
    if (selectedIds.length === 0) return alert("Select questions first");
    
    setIsSaving(true);
    let success = 0;

    for (const id of selectedIds) {
      const q = questions.find(item => item.id === id);
      if (!q) continue; // Skip if question not found locally

      try {
        // Triggers the server action we added to actions.ts
        await autoAssignImage(id, q.searchQuery || q.text);
        success++;
      } catch (err) {
        console.error(`Search failed for: ${q.text}`, err);
      }
    }

    alert(`Finished! Found images for ${success} out of ${selectedIds.length} items.`);
    setSelectedIds([]);
    loadData(); // Refresh table to show new images/labels
    setIsSaving(false);
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const isAllSelected = filteredQuestions.length > 0 && filteredQuestions.every(q => selectedIds.includes(q.id));
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map(q => q.id));
    }
  };

  const handleBulkUpload = async () => {
    if (!csvContent.trim()) return;
    setIsSaving(true);

    try {
      const lines = csvContent.trim().split('\n');
      const data = lines
        .filter(line => line.trim())
        .map(line => {
          // Auto-detect delimiter (Tab for Excel copy-paste, Comma for standard CSV)
          const delimiter = line.includes('\t') ? '\t' : ',';
          // Split and remove quotes if present
          const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
          
          return {
            question: cols[0],
            option1: cols[1],
            option2: cols[2],
            option3: cols[3],
            correctIndex: cols[4],
            difficulty: cols[5]
          };
        })
        .filter(item => item.question && item.question.toLowerCase() !== 'question'); // Skip header

      await bulkUploadQuestions(quizId, JSON.stringify(data));
      setIsBulkUploadOpen(false);
      setCsvContent('');
      loadData();
      alert(`Successfully uploaded ${data.length} questions.`);
    } catch (e) {
      console.error(e);
      alert("Upload failed. Please check your CSV format.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkLevelChange = async (newLevel: string) => {
    setIsSaving(true);
    await bulkUpdateDifficulty(selectedIds, newLevel);
    setSelectedIds([]);
    loadData();
    setIsSaving(false);
  };

  const handleBulkGenerateAudio = async () => {
    if (selectedIds.length === 0) return alert("Select questions first");
    
    setIsSaving(true);
    let success = 0;
    let failed = 0;

    for (const id of selectedIds) {
      try {
        const result = await generateQuestionAudioWithTTS(id, 'en');
        
        if (result.success && result.audioUrl) {
          success++;
          // Update local state to reflect the new audio immediately
          setQuestions(prev => prev.map(q => q.id === id ? { 
            ...q, 
            audioUrls: { ...(q.audioUrls || {}), en: result.audioUrl },
            audioUrl: result.audioUrl 
          } : q));
        } else {
          failed++;
        }
      } catch (e) {
        console.error(e);
        failed++;
      }
    }

    setIsSaving(false);
    alert(`Audio Generation Complete.\nSuccess: ${success}\nFailed: ${failed}`);
    setSelectedIds([]);
  };

  const handleSingleAiSearch = (target: 'question' | 'quiz') => {
    let defaultQuery = '';
    
    if (target === 'question') {
      if (!editingQuestion?.id) return alert("Please save the question first to enable AI search.");
      const correctAnswer = editingQuestion.answers?.find((a: any) => a.isCorrect)?.text || "";
      defaultQuery = `${correctAnswer} ${editingQuestion.text || ""}`.trim();
    } else {
      // Quiz search
      defaultQuery = quiz?.title || "";
    }
    
    // Open modal and trigger initial search
    setAiSearchModal({ 
      isOpen: true, 
      query: defaultQuery, 
      results: [], 
      provider: 'pexels', 
      isSearching: true,
      target
    });
    
    performImageSearch(defaultQuery, 'pexels');
  };

  const performImageSearch = async (query: string, provider: 'pexels' | 'wikimedia') => {
    setAiSearchModal(prev => ({ ...prev, isSearching: true, query, provider }));
    try {
      const results = await searchImages(query, provider);
      setAiSearchModal(prev => ({ ...prev, results, isSearching: false }));
    } catch (err) {
      console.error(err);
      setAiSearchModal(prev => ({ ...prev, isSearching: false }));
    }
  };

  const selectImage = (img: any) => {
    if (aiSearchModal.target === 'question') {
      const newMeta = {
        photographer: img.photographer || null,
        source: img.provider || img.source,
      };

      // Calculate and set orientation for the form submission
      const orientation = (img.width && img.height && img.width >= img.height) ? 'landscape' : 'portrait';
      setManualOrientation(orientation);
      
      setEditingQuestion((prev: any) => ({ 
        ...prev, 
        imageUrl: img.url,
        imageMeta: { ...(prev.imageMeta || {}), ...newMeta, orientation }
      }));
    } else {
      // Quiz Image
      setQuiz((prev: any) => ({
        ...prev,
        imageUrl: img.url
      }));
    }
    
    setAiSearchModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        const orientation = img.width >= img.height ? 'landscape' : 'portrait';
        setManualOrientation(orientation);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const handleGenerateAudio = async () => {
    if (!editingQuestion?.id) return alert("Please save the question first.");
    
    setIsGeneratingAudio(true);
    try {
      const result = await generateQuestionAudioWithTTS(editingQuestion.id, 'en');
      
      if (result.success && result.audioUrl) {
        // Update local state for immediate feedback
        const updatedAudioUrls = { ...(editingQuestion.audioUrls || {}), en: result.audioUrl };
        
        setEditingQuestion((prev: any) => ({ ...prev, audioUrls: updatedAudioUrls, audioUrl: result.audioUrl }));
        setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { 
          ...q, 
          audioUrls: updatedAudioUrls,
          audioUrl: result.audioUrl 
        } : q));
      } else {
        alert("Failed to generate audio: " + (result.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while generating audio.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Helper: Resize image on client
  const resizeImage = (file: File, maxWidth = 1600, maxHeight = 1000): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8);
      };
      img.onerror = reject;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto pb-32 text-slate-900 font-sans">
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />

      <div className="flex justify-between items-end mb-8">
        <div><h4 className="text-sm uppercase text-slate-500 font-bold tracking-wide">Questions for:</h4>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{quiz?.title || 'Loading...'}</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              // TODO: Paste the full URL from 'firebase functions:list' here
              const functionUrl = 'https://us-central1-trivia-34f8c.cloudfunctions.net/exportGameZip';
              window.open(`${functionUrl}?quizId=${quizId}&t=${Date.now()}`, '_blank');
            }}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <span className="material-symbols-rounded">folder_zip</span> Export ZIP
          </button>
          <button onClick={() => setIsBulkUploadOpen(true)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2">
            <span className="material-symbols-rounded">content_paste_go</span> Bulk Upload
          </button>
          <button onClick={() => { setEditingQuestion(null); setManualOrientation('landscape'); setIsDrawerOpen(true); }} className="bg-[#5233a6] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#3e2680] transition-all">+ Add Question</button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="sticky top-2 z-30 flex flex-wrap gap-4 mb-6 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex gap-4 items-center">
          <span className="text-sm font-bold uppercase text-slate-500">Filters:</span>
          <input 
            type="text" 
            placeholder="Search questions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-[#5233a6] outline-none w-48"
          />
          <select 
              value={filterLevel} 
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-700 focus:ring-2 focus:ring-[#5233a6] outline-none"
          >
              <option value="all">All Levels</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
          </select>
          
          <select 
              value={filterImage} 
              onChange={(e) => setFilterImage(e.target.value)}
              className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-700 focus:ring-2 focus:ring-[#5233a6] outline-none"
          >
              <option value="all">All Images</option>
              <option value="has-image">With Image</option>
              <option value="no-image">No Image</option>
          </select>

          <select 
              value={filterAudio} 
              onChange={(e) => setFilterAudio(e.target.value)}
              className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-700 focus:ring-2 focus:ring-[#5233a6] outline-none"
          >
              <option value="all">All Audio</option>
              <option value="has-audio">With Audio</option>
              <option value="no-audio">No Audio</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex gap-3 items-center animate-in fade-in slide-in-from-right-4 border-l pl-6 border-slate-200">
            <span className="text-xs font-bold uppercase text-slate-500">
                Bulk ({selectedIds.length}):
            </span>
            <select 
              onChange={(e) => handleBulkLevelChange(e.target.value)}
              disabled={isSaving}
              value=""
              className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-700 focus:ring-2 focus:ring-[#5233a6] outline-none"
            >
              <option value="" disabled>Set Level</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            <button 
              onClick={handleBulkAiSearch}
              disabled={isSaving}
              className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
            >
               <span>✨</span> Find Images
            </button>

            <button 
              onClick={handleBulkGenerateAudio}
              disabled={isSaving}
              className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
            >
               <span>🔊</span> Generate Audio
            </button>

            <button 
              onClick={() => setDeleteConfig({ isOpen: true, ids: selectedIds })}
              disabled={isSaving}
              className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white text-sm border-b border-slate-200">
              <th className="p-5 w-12 first:rounded-tl-2xl">
                <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded text-[#5233a6] focus:ring-0 cursor-pointer bg-white border-slate-300" />
              </th>
              <th className="p-5 w-20">Image</th>
              <th className="p-5 w-16 text-center">Audio</th>
              <th className="p-5">Question</th>
              <th className="p-5">Correct Answer</th>
              <th className="p-5">Level</th>
              <th className="p-5 text-right pr-10 last:rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredQuestions.map((q) => (
              <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-5">
                   <input type="checkbox" checked={selectedIds.includes(q.id)} onChange={() => toggleSelectOne(q.id)} className="rounded text-[#5233a6] focus:ring-0 cursor-pointer bg-white border-slate-300" />
                </td>
                <td className="p-5">
                  {q.imageUrl ? (
                    <img src={q.imageUrl} className="h-10 w-10 rounded-lg object-cover border border-slate-200" alt="" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] text-slate-400 font-bold">NONE</div>
                  )}
                </td>
                <td className="p-5 text-center">
                  {(q.audioUrl || (q.audioUrls && Object.keys(q.audioUrls).length > 0)) && (
                    <span className="material-symbols-rounded text-[#5233a6]">mic</span>
                  )}
                </td>
                <td className="p-5 font-medium max-w-xs truncate text-slate-900">{q.text}</td>
                <td className="p-5 text-sm text-slate-500 max-w-xs truncate">{q.answers?.find((a: any) => a.isCorrect)?.text || '-'}</td>
                <td className="p-5 text-xs font-bold uppercase text-slate-500">{q.difficulty || 'medium'}</td>
                <td className="p-5 text-right pr-10 relative">
                  <button 
                    onClick={() => setActiveMenu(activeMenu === q.id ? null : q.id)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 hover:shadow-sm text-slate-400 hover:text-[#5233a6] transition-all font-bold text-xl"
                  >
                    ⋮
                  </button>
                  {activeMenu === q.id && (
                    <div className="absolute right-10 top-14 w-32 bg-white rounded-lg shadow-2xl ring-1 ring-black/5 z-[100] py-2 animate-in fade-in zoom-in-95 duration-100 text-left">
                      <button 
                        onClick={() => { setEditingQuestion(q); setManualOrientation(q.imageMeta?.orientation || 'landscape'); setIsDrawerOpen(true); setActiveMenu(null); }}
                        className="w-full px-4 py-2 text-sm font-bold text-slate-600 hover:bg-[#5233a6]/10 hover:text-[#5233a6] transition-colors text-left"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => { setDeleteConfig({ isOpen: true, ids: [q.id] }); setActiveMenu(null); }}
                        className="w-full px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-left"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DRAWER */}
      {isDrawerOpen && (
        <div className="fixed inset-y-0 right-0 z-[120] w-full max-w-xl bg-white p-10 shadow-2xl overflow-y-auto border-l border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">{editingQuestion ? 'Edit' : 'Add'} Question</h2>
            <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsSaving(true);
            const formData = new FormData(e.currentTarget);

            // Client-side Upload
            const file = formData.get('imageFile') as File;
            if (file && file.size > 0) {
              const resizedBlob = await resizeImage(file);
              const storageRef = ref(storage, `trivia/question-images/${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.jpg`);
              await uploadBytes(storageRef, resizedBlob, { contentType: 'image/jpeg' });
              const downloadUrl = await getDownloadURL(storageRef);
              formData.set('existingImageUrl', downloadUrl);
            }

            const result = await upsertQuestion(editingQuestion?.id || null, quizId, formData);
            
            // Update local state if result is returned (useful for new questions to get ID)
            if (result && typeof result === 'object' && (result as any).id) {
              setEditingQuestion((prev: any) => ({ ...prev, ...(result as any) }));
            }

            await loadData();
            setIsSaving(false);
          }} className="space-y-6 pb-20">
            
            <input type="hidden" name="existingImageUrl" value={editingQuestion?.imageUrl || ''} readOnly />
            <input type="hidden" name="orientation" value={manualOrientation} />
            <input type="hidden" name="imagePhotographer" value={editingQuestion?.imageMeta?.photographer || ''} />
            <input type="hidden" name="imageSource" value={editingQuestion?.imageMeta?.source || ''} />

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Question Image</label>
              {editingQuestion?.imageUrl ? (
                <div className="relative w-full h-48 group rounded-lg overflow-hidden border border-slate-200">
                  <img src={editingQuestion.imageUrl} className="w-full h-full object-cover" alt="Question" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button 
                      type="button"
                      onClick={() => handleSingleAiSearch('question')}
                      className="bg-white/90 text-[#5233a6] p-2 rounded-full shadow-md hover:bg-white transition-all"
                      title="Find Replacement (AI)"
                    >
                      <span>✨</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditingQuestion({ ...editingQuestion, imageUrl: '' })}
                      className="bg-red-500 text-white p-2 rounded-full shadow-md hover:bg-red-600 transition-all"
                      title="Remove Image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input 
                    type="file" 
                    name="imageFile" 
                    accept="image/*" 
                    onChange={handleFileSelect}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-6 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#5233a6]/10 file:text-[#5233a6] hover:file:bg-[#5233a6]/20 transition-all" 
                  />
                  
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase">Layout:</span>
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><input type="radio" name="orientation_selector" checked={manualOrientation === 'landscape'} onChange={() => setManualOrientation('landscape')} className="text-[#5233a6] focus:ring-[#5233a6] bg-white border-slate-300" /> Landscape</label>
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><input type="radio" name="orientation_selector" checked={manualOrientation === 'portrait'} onChange={() => setManualOrientation('portrait')} className="text-[#5233a6] focus:ring-[#5233a6] bg-white border-slate-300" /> Portrait</label>
                  </div>

                  <>
                    <div className="text-center text-xs text-slate-400 font-bold uppercase">OR</div>
                    <button 
                      type="button"
                      onClick={() => handleSingleAiSearch('question')}
                      className="w-full py-3 bg-[#5233a6]/10 text-[#5233a6] rounded-lg text-xs font-bold hover:bg-[#5233a6]/20 transition-all flex items-center justify-center gap-2"
                    >
                      <span>✨</span> Find Image with AI
                    </button>
                  </>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Question Text</label>
              <textarea name="text" defaultValue={editingQuestion?.text} required className="w-full p-3 bg-slate-50 text-slate-900 rounded-lg border-0 focus:ring-2 focus:ring-[#5233a6] outline-none placeholder-slate-400" rows={3} />
            </div>

            {/* Audio Section */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Audio (English)</label>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                {(editingQuestion?.audioUrls?.en || editingQuestion?.audioUrl) ? (
                  <audio controls src={editingQuestion.audioUrls?.en || editingQuestion.audioUrl} className="h-10 w-full" />
                ) : (
                  <span className="text-xs text-slate-400 italic w-full text-center sm:text-left">No audio generated</span>
                )}
                
                <button
                  type="button"
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio || !editingQuestion?.id}
                  className="px-4 py-2 bg-[#5233a6]/10 text-[#5233a6] rounded-lg text-xs font-bold hover:bg-[#5233a6]/20 transition-colors disabled:opacity-50 whitespace-nowrap w-full sm:w-auto"
                >
                  {isGeneratingAudio ? 'Generating...' : ((editingQuestion?.audioUrls?.en || editingQuestion?.audioUrl) ? 'Regenerate' : 'Generate Audio')}
                </button>
              </div>
              {!editingQuestion?.id && <p className="text-[10px] text-slate-400 mt-1 text-right">Save question to generate audio</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Difficulty</label>
              <select name="difficulty" defaultValue={editingQuestion?.difficulty || 'medium'} className="w-full p-3 bg-slate-50 text-slate-900 rounded-lg border-0 focus:ring-2 focus:ring-[#5233a6] outline-none">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Answers & Correct Option</label>
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <input 
                      type="radio" 
                      name="correctIndex" 
                      value={i} 
                      defaultChecked={editingQuestion ? editingQuestion.answers?.[i]?.isCorrect : i === 0}
                      className="w-5 h-5 text-[#5233a6] border-slate-300 bg-white focus:ring-[#5233a6]"
                    />
                    <input name={`opt${i}`} defaultValue={editingQuestion?.answers?.[i]?.text} placeholder={`Answer Option ${i + 1}`} className="flex-1 bg-transparent border-0 text-sm text-slate-900 focus:ring-0 outline-none placeholder-slate-400" required />
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isSaving} className="w-full bg-[#5233a6] text-white py-4 rounded-lg font-bold shadow-lg hover:bg-[#3e2680] transition-all">
              {isSaving ? 'Saving...' : 'Save Question'}
            </button>
            <button type="button" onClick={() => setIsDrawerOpen(false)} className="w-full text-slate-400 font-bold py-2 hover:text-slate-600 transition-colors">Close</button>
            
            {editingQuestion && (
              <button 
                type="button" 
                onClick={() => { setIsDrawerOpen(false); setDeleteConfig({ isOpen: true, ids: [editingQuestion.id] }); }}
                className="w-full text-red-500 font-bold py-2 hover:bg-red-50 rounded-lg transition-colors mt-2"
              >
                Delete Question
              </button>
            )}
          </form>
        </div>
      )}

      {/* QUIZ DRAWER */}
      {isQuizDrawerOpen && (
        <div className="fixed inset-y-0 right-0 z-[120] w-full max-w-xl bg-white p-10 shadow-2xl overflow-y-auto border-l border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Edit Quiz Details</h2>
            <button onClick={() => setIsQuizDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsSaving(true);
            const formData = new FormData(e.currentTarget);

            const file = formData.get('imageFile') as File;
            if (file && file.size > 0) {
              const resizedBlob = await resizeImage(file);
              const storageRef = ref(storage, `trivia/quiz-covers/${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.jpg`);
              await uploadBytes(storageRef, resizedBlob, { contentType: 'image/jpeg' });
              const downloadUrl = await getDownloadURL(storageRef);
              formData.set('existingImageUrl', downloadUrl);
            }

            await upsertQuiz(quizId, null, formData);
            await loadData();
            setIsQuizDrawerOpen(false);
            setIsSaving(false);
          }} className="space-y-6 pb-20">
            
            <input type="hidden" name="existingImageUrl" value={quiz?.imageUrl || ''} readOnly />

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cover Image</label>
              {quiz?.imageUrl ? (
                <div className="relative w-full h-48 group rounded-lg overflow-hidden border border-slate-200">
                  <img src={quiz.imageUrl} className="w-full h-full object-cover" alt="Cover" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button 
                      type="button"
                      onClick={() => handleSingleAiSearch('quiz')}
                      className="bg-white/90 text-[#5233a6] p-2 rounded-full shadow-md hover:bg-white transition-all"
                      title="Find Replacement (AI)"
                    >
                      <span>✨</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setQuiz({ ...quiz, imageUrl: '' })}
                      className="bg-red-500 text-white p-2 rounded-full shadow-md hover:bg-red-600 transition-all"
                      title="Remove Image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input type="file" name="imageFile" accept="image/*" className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all" />
                  <div className="text-center text-xs text-slate-400 font-bold uppercase">OR</div>
                  <button 
                    type="button"
                    onClick={() => handleSingleAiSearch('quiz')}
                        className="w-full py-3 bg-[#5233a6]/10 text-[#5233a6] rounded-lg text-xs font-bold hover:bg-[#5233a6]/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>✨</span> Find Cover Image
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Title</label>
              <input name="title" defaultValue={quiz?.title} required className="w-full p-3 bg-slate-50 text-slate-900 rounded-lg border-0 focus:ring-2 focus:ring-[#5233a6] outline-none placeholder-slate-400" />
            </div>

            <button type="submit" disabled={isSaving} className="w-full bg-[#5233a6] text-white py-4 rounded-lg font-bold shadow-lg hover:bg-[#3e2680] transition-all">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {isBulkUploadOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[130]" onClick={() => setIsBulkUploadOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-[140] p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Bulk Upload Questions</h3>
              <button onClick={() => setIsBulkUploadOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl mb-6 text-xs text-slate-500 font-mono border border-slate-200">
              <p className="font-bold mb-2 text-slate-700">REQUIRED COLUMNS (Comma or Tab separated):</p>
              question, option1, option2, option3, correctIndex, difficulty
              <br/><br/>
              <span className="italic">* correctIndex should be 1, 2, or 3.</span>
            </div>

            <textarea 
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste your CSV data here..."
              className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#5233a6] outline-none mb-6 resize-none text-slate-900 placeholder-slate-400"
            />

            <div className="flex gap-3">
              <button 
                onClick={handleBulkUpload}
                disabled={isSaving || !csvContent}
                className="flex-1 bg-[#5233a6] hover:bg-[#3e2680] text-white py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Uploading...' : 'Process & Upload'}
              </button>
              <button onClick={() => setIsBulkUploadOpen(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* AI SEARCH MODAL */}
      {aiSearchModal.isOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]" onClick={() => setAiSearchModal(prev => ({ ...prev, isOpen: false }))} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-2xl shadow-2xl z-[160] p-8 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Find Image</h3>
            
            <div className="flex gap-4 mb-4">
              <input 
                value={aiSearchModal.query}
                onChange={(e) => setAiSearchModal({ ...aiSearchModal, query: e.target.value })}
                className="flex-1 bg-slate-50 border-0 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#5233a6] text-slate-900 placeholder-slate-400"
                placeholder="Search query..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && performImageSearch(aiSearchModal.query, aiSearchModal.provider)}
              />
              <button 
                onClick={() => performImageSearch(aiSearchModal.query, aiSearchModal.provider)}
                className="bg-[#5233a6] text-white px-6 rounded-lg font-bold text-sm hover:bg-[#3e2680]"
              >
                Search
              </button>
            </div>

            <div className="flex gap-2 mb-6 border-b border-slate-100 pb-2">
              <button 
                onClick={() => performImageSearch(aiSearchModal.query, 'pexels')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${aiSearchModal.provider === 'pexels' ? 'bg-[#5233a6]/20 text-[#5233a6]' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Pexels
              </button>
              <button 
                onClick={() => performImageSearch(aiSearchModal.query, 'wikimedia')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${aiSearchModal.provider === 'wikimedia' ? 'bg-[#5233a6]/20 text-[#5233a6]' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Wikicommons
              </button>
            </div>

            {aiSearchModal.isSearching ? (
              <div className="py-10 text-center text-slate-400">Searching...</div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {aiSearchModal.results.map((img, idx) => (
                  <div key={idx} onClick={() => selectImage(img)} className="group relative aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:ring-4 ring-[#5233a6] transition-all">
                    <img src={img.url} className="w-full h-full object-cover" alt="Result" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-2 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {img.photographer}
                    </div>
                  </div>
                ))}
                {aiSearchModal.results.length === 0 && <div className="col-span-3 text-center py-10 text-slate-400">No images found.</div>}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setAiSearchModal(prev => ({ ...prev, isOpen: false }))}
                className="px-6 py-2 bg-slate-100 text-slate-500 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* FIXED MODAL COMPONENT */}
      <ModalConfirm
        isOpen={deleteConfig.isOpen}
        title="Delete Questions"
        description={`Are you sure you want to delete ${deleteConfig.ids.length} questions? This cannot be undone.`}
        onClose={() => setDeleteConfig({ isOpen: false, ids: [] })}
        onConfirm={async () => {
          setIsSaving(true);
          await bulkDeleteQuestions(deleteConfig.ids);
          setDeleteConfig({ isOpen: false, ids: [] });
          setSelectedIds([]);
          loadData();
          setIsSaving(false);
        }}
      />

      {/* Global Menus Backdrop */}
      {activeMenu && <div className="fixed inset-0 z-[90]" onClick={() => setActiveMenu(null)} />}
    </div>
  );
}