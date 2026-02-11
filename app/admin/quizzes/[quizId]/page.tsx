'use client';

import { useEffect, useState, use as useReact } from 'react';
import { 
  getQuestions, 
  upsertQuestion, 
  bulkDeleteQuestions, 
  bulkUpdateDifficulty,
  bulkUploadQuestions,
  autoAssignImage 
} from '../../topics/actions';
import ModalConfirm from '@/components/ModalConfirm';
import { generateQuestionAudioWithTTS } from '../../../actions';

export default function QuestionsPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = useReact(params);
  const [questions, setQuestions] = useState<any[]>([]);
  const [quizTitle, setQuizTitle] = useState('Loading...');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [deleteConfig, setDeleteConfig] = useState<{ isOpen: boolean; ids: string[] }>({ isOpen: false, ids: [] });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [aiSearchModal, setAiSearchModal] = useState({ isOpen: false, query: '' });
  const [manualOrientation, setManualOrientation] = useState<string>('landscape');
  
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterImage, setFilterImage] = useState<string>('all');
  const [filterAudio, setFilterAudio] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { if (quizId) loadData(); }, [quizId]);

  const loadData = async () => {
    const { questions, quizTitle } = await getQuestions(quizId);
    setQuestions(questions);
    setQuizTitle(quizTitle);
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

  const handleSingleAiSearch = () => {
    if (!editingQuestion?.id) return alert("Please save the question first.");
    
    const correctAnswer = editingQuestion.answers?.find((a: any) => a.isCorrect)?.text || "";
    const defaultQuery = `${editingQuestion.text || ""} ${correctAnswer}`.trim();
    
    setAiSearchModal({ isOpen: true, query: defaultQuery });
  };

  const performAiSearch = async () => {
    if (!editingQuestion?.id || !aiSearchModal.query) return;
    
    setIsSaving(true);
    try {
      const result = await autoAssignImage(editingQuestion.id, aiSearchModal.query);
      setEditingQuestion((prev: any) => ({ ...prev, ...result }));
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...q, ...result } : q));
      setAiSearchModal({ isOpen: false, query: '' });
    } catch (err) {
      console.error(err);
      alert("Failed to find image.");
    } finally {
      setIsSaving(false);
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto bg-slate-50 min-h-screen pb-32">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">{quizTitle}</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsBulkUploadOpen(true)} className="bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-6 py-2 rounded-full text-sm font-bold shadow-sm transition-all">
            ☁️ Bulk Upload
          </button>
          <button onClick={() => { setEditingQuestion(null); setIsDrawerOpen(true); }} className="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-md">+ Add Question</button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="sticky top-2 z-30 flex flex-wrap gap-4 mb-6 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex gap-4 items-center">
          <span className="text-xs font-bold uppercase text-slate-400">Filters:</span>
          <input 
            type="text" 
            placeholder="Search questions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none w-48"
          />
          <select 
              value={filterLevel} 
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
              <option value="all">All Levels</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
          </select>
          
          <select 
              value={filterImage} 
              onChange={(e) => setFilterImage(e.target.value)}
              className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
              <option value="all">All Images</option>
              <option value="has-image">With Image</option>
              <option value="no-image">No Image</option>
          </select>

          <select 
              value={filterAudio} 
              onChange={(e) => setFilterAudio(e.target.value)}
              className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
              <option value="all">All Audio</option>
              <option value="has-audio">With Audio</option>
              <option value="no-audio">No Audio</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex gap-3 items-center animate-in fade-in slide-in-from-right-4 border-l pl-6 border-slate-100">
            <span className="text-xs font-bold uppercase text-slate-400">
                Bulk ({selectedIds.length}):
            </span>
            <select 
              onChange={(e) => handleBulkLevelChange(e.target.value)}
              disabled={isSaving}
              value=""
              className="bg-slate-50 border-0 rounded-lg text-sm py-2 px-4 font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="" disabled>Set Level</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            <button 
              onClick={handleBulkAiSearch}
              disabled={isSaving}
              className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
            >
               <span>✨</span> Find Images
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

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white text-sm">
              <th className="sticky top-[85px] z-20 p-5 w-12 first:rounded-tl-2xl">
                <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded text-indigo-500 focus:ring-0 cursor-pointer" />
              </th>
              <th className="sticky top-[85px] z-20 p-5 w-20">Image</th>
              <th className="sticky top-[85px] z-20 p-5 w-16 text-center">Audio</th>
              <th className="sticky top-[85px] z-20 p-5">Question</th>
              <th className="sticky top-[85px] z-20 p-5">Correct Answer</th>
              <th className="sticky top-[85px] z-20 p-5">Level</th>
              <th className="sticky top-[85px] z-20 p-5 text-right pr-10 last:rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredQuestions.map((q) => (
              <tr key={q.id} className="hover:bg-slate-50">
                <td className="p-5">
                   <input type="checkbox" checked={selectedIds.includes(q.id)} onChange={() => toggleSelectOne(q.id)} />
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
                    <span className="text-lg text-indigo-600">🔊</span>
                  )}
                </td>
                <td className="p-5 font-medium max-w-xs truncate">{q.text}</td>
                <td className="p-5 text-sm text-slate-500 max-w-xs truncate">{q.answers?.find((a: any) => a.isCorrect)?.text || '-'}</td>
                <td className="p-5 text-xs font-bold uppercase text-slate-400">{q.difficulty || 'medium'}</td>
                <td className="p-5 text-right pr-10 relative">
                  <button 
                    onClick={() => setActiveMenu(activeMenu === q.id ? null : q.id)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm text-slate-400 hover:text-indigo-600 transition-all font-bold text-xl"
                  >
                    ⋮
                  </button>
                  {activeMenu === q.id && (
                    <div className="absolute right-10 top-14 w-32 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 z-[100] py-2 animate-in fade-in zoom-in-95 duration-100 text-left">
                      <button 
                        onClick={() => { setEditingQuestion(q); setIsDrawerOpen(true); setActiveMenu(null); }}
                        className="w-full px-4 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => { setDeleteConfig({ isOpen: true, ids: [q.id] }); setActiveMenu(null); }}
                        className="w-full px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors text-left"
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
        <div className="fixed inset-y-0 right-0 z-[120] w-full max-w-xl bg-white p-10 shadow-2xl overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6">{editingQuestion ? 'Edit' : 'Add'} Question</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsSaving(true);
            await upsertQuestion(editingQuestion?.id || null, quizId, new FormData(e.currentTarget));
            setIsDrawerOpen(false);
            loadData();
            setIsSaving(false);
          }} className="space-y-6 pb-20">
            
            <input type="hidden" name="existingImageUrl" value={editingQuestion?.imageUrl || ''} readOnly />
            <input type="hidden" name="orientation" value={manualOrientation} />

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Question Image</label>
              {editingQuestion?.imageUrl ? (
                <div className="relative w-full h-48 group rounded-xl overflow-hidden border border-slate-200">
                  <img src={editingQuestion.imageUrl} className="w-full h-full object-cover" alt="Question" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button 
                      type="button"
                      onClick={handleSingleAiSearch}
                      className="bg-white/90 text-indigo-600 p-2 rounded-full shadow-md hover:bg-white transition-all"
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
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all" 
                  />
                  
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase">Layout:</span>
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><input type="radio" name="orientation_selector" checked={manualOrientation === 'landscape'} onChange={() => setManualOrientation('landscape')} /> Landscape</label>
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><input type="radio" name="orientation_selector" checked={manualOrientation === 'portrait'} onChange={() => setManualOrientation('portrait')} /> Portrait</label>
                  </div>

                  {editingQuestion?.id && (
                    <>
                      <div className="text-center text-xs text-slate-400 font-bold uppercase">OR</div>
                      <button 
                        type="button"
                        onClick={handleSingleAiSearch}
                        className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                      >
                        <span>✨</span> Find Image with AI
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Question Text</label>
              <textarea name="text" defaultValue={editingQuestion?.text} required className="w-full p-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} />
            </div>

            {/* Audio Section */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Audio (English)</label>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                {(editingQuestion?.audioUrls?.en || editingQuestion?.audioUrl) ? (
                  <audio controls src={editingQuestion.audioUrls?.en || editingQuestion.audioUrl} className="h-10 w-full" />
                ) : (
                  <span className="text-xs text-slate-400 italic w-full text-center sm:text-left">No audio generated</span>
                )}
                
                <button
                  type="button"
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio || !editingQuestion?.id}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200 transition-colors disabled:opacity-50 whitespace-nowrap w-full sm:w-auto"
                >
                  {isGeneratingAudio ? 'Generating...' : ((editingQuestion?.audioUrls?.en || editingQuestion?.audioUrl) ? 'Regenerate' : 'Generate Audio')}
                </button>
              </div>
              {!editingQuestion?.id && <p className="text-[10px] text-slate-400 mt-1 text-right">Save question to generate audio</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Difficulty</label>
              <select name="difficulty" defaultValue={editingQuestion?.difficulty || 'medium'} className="w-full p-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Answers & Correct Option</label>
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <input 
                      type="radio" 
                      name="correctIndex" 
                      value={i} 
                      defaultChecked={editingQuestion ? editingQuestion.answers?.[i]?.isCorrect : i === 0}
                      className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <input name={`opt${i}`} defaultValue={editingQuestion?.answers?.[i]?.text} placeholder={`Answer Option ${i + 1}`} className="flex-1 bg-transparent border-0 text-sm focus:ring-0 outline-none" required />
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg">
              {isSaving ? 'Saving...' : 'Save Question'}
            </button>
            <button type="button" onClick={() => setIsDrawerOpen(false)} className="w-full text-slate-400 font-bold py-2">Cancel</button>
            
            {editingQuestion && (
              <button 
                type="button" 
                onClick={() => { setIsDrawerOpen(false); setDeleteConfig({ isOpen: true, ids: [editingQuestion.id] }); }}
                className="w-full text-red-500 font-bold py-2 hover:bg-red-50 rounded-xl transition-colors mt-2"
              >
                Delete Question
              </button>
            )}
          </form>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {isBulkUploadOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[130]" onClick={() => setIsBulkUploadOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-[140] p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Bulk Upload Questions</h3>
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
              className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none mb-6 resize-none"
            />

            <div className="flex gap-3">
              <button 
                onClick={handleBulkUpload}
                disabled={isSaving || !csvContent}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Uploading...' : 'Process & Upload'}
              </button>
              <button onClick={() => setIsBulkUploadOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* AI SEARCH MODAL */}
      {aiSearchModal.isOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]" onClick={() => setAiSearchModal({ ...aiSearchModal, isOpen: false })} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-[160] p-8 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Find Image with AI</h3>
            <p className="text-xs text-slate-500 mb-4">Refine your search query to get the best results from Pexels.</p>
            
            <input 
              value={aiSearchModal.query}
              onChange={(e) => setAiSearchModal({ ...aiSearchModal, query: e.target.value })}
              className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
              placeholder="e.g. Eiffel Tower Paris"
              autoFocus
            />

            <div className="flex gap-3">
              <button 
                onClick={performAiSearch}
                disabled={isSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                {isSaving ? 'Searching...' : 'Search & Assign'}
              </button>
              <button 
                onClick={() => setAiSearchModal({ ...aiSearchModal, isOpen: false })}
                className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
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