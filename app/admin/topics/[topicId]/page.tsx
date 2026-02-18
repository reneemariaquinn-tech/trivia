'use client';

import { useEffect, useState, use as useReact } from 'react';
import { getQuizzes, deleteQuiz, upsertQuiz } from '../actions';
import Link from 'next/link';
import { searchImages } from '../../../actions';

export default function QuizzesPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = useReact(params);
  
  // Data States
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [categoryTitle, setCategoryTitle] = useState('Loading...');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drawer & Edit States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<any>(null);

  // Delete Modal States
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [aiSearchModal, setAiSearchModal] = useState<{
    isOpen: boolean;
    query: string;
    results: any[];
    provider: 'pexels' | 'wikimedia';
    isSearching: boolean;
  }>({ isOpen: false, query: '', results: [], provider: 'pexels', isSearching: false });

  useEffect(() => {
    loadQuizzes();
  }, [topicId]);

 const loadQuizzes = async () => {
    try {
      const data = await getQuizzes(topicId);
      setQuizzes(data.quizzes);
      // Try both possible keys just in case
      setCategoryTitle(data.topicTitle || data.categoryName || "Unknown Topic");
    } catch (error) {
      console.error("Failed to load quizzes:", error);
      setCategoryTitle("Error Loading Category");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    const file = formData.get('imageFile') as File;
    const MAX_SIZE = 1024 * 1024; // 1MB

    if (file && file.size > MAX_SIZE) {
      alert(`Image is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Please keep it under 1MB.`);
      return;
    }

    try {
      await upsertQuiz(editingQuiz?.id || null, topicId, formData);
      setIsDrawerOpen(false);
      loadQuizzes();
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Error saving quiz. Check console for details.");
    }
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
    setEditingQuiz((prev: any) => ({ ...(prev || {}), imageUrl: img.url }));
    setAiSearchModal(prev => ({ ...prev, isOpen: false }));
  };

const filtered = quizzes.filter(q => 
    (q.title?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto bg-slate-50 min-h-screen text-slate-700">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Link href="/admin/topics" className="text-indigo-600 hover:text-indigo-800 text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-colors">
          ← Back
        </Link>
      </div>

      {/* Dynamic Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Topic / Category</p>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">{categoryTitle}</h1>
        </div>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Search quizzes..."
            className="bg-white border-0 shadow-sm rounded-full px-6 py-2 text-sm w-72 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => { setEditingQuiz(null); setIsDrawerOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full text-sm font-bold shadow-md shadow-indigo-200 transition-all"
          >
            + Add New Quiz
          </button>
        </div>
      </div>

      {/* Quiz Table */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-visible">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white text-sm">
              <th className="p-5 text-white font-semibold text-sm first:rounded-tl-2xl w-24">Cover</th>
              <th className="p-5 text-white font-semibold text-sm">Quiz Title</th>
              <th className="p-5 text-white font-semibold text-sm">Description</th>
              <th className="p-5 text-white font-semibold text-sm text-center">Questions</th>
              <th className="p-5 text-white font-semibold text-sm text-right pr-10 last:rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((quiz) => (
                <tr key={quiz.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="p-5">
                    {quiz.imageUrl ? (
                      <img src={quiz.imageUrl} className="h-12 w-12 rounded-xl object-cover border-2 border-white shadow-sm" alt="" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase border border-dashed border-slate-300">No Img</div>
                    )}
                  </td>
                  <td className="p-5 font-bold text-slate-800">
                    <Link href={`/admin/quizzes/${quiz.id}`} className="hover:text-indigo-600 transition-colors">
                      {quiz.title}
                    </Link>
                  </td>
                  <td className="p-5 text-sm text-slate-500 max-w-xs truncate">{quiz.description || "No description provided."}</td>
                  <td className="px-6 py-4">
  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
    {quiz.questionCount || 0}
  </div>
</td>
                  <td className="p-5 text-right pr-10 relative">
                    <button 
                      onClick={() => setActiveMenu(activeMenu === quiz.id ? null : quiz.id)}
                      className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm text-slate-400 hover:text-indigo-600 transition-all font-bold text-xl"
                    >
                      ⋮
                    </button>

                    {activeMenu === quiz.id && (
                      <div className="absolute right-10 top-14 w-44 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 z-[100] py-2 animate-in fade-in zoom-in-95 duration-100 text-left">
                        <button 
                          onClick={() => { setEditingQuiz(quiz); setIsDrawerOpen(true); setActiveMenu(null); }}
                          className="w-full px-4 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          Edit Settings
                        </button>
                        <Link 
                          href={`/admin/quizzes/${quiz.id}`}
                          className="block w-full px-4 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          Manage Questions
                        </Link>
                        <div className="h-px bg-slate-100 my-1" />
                        <button 
                          onClick={() => { setDeleteTarget(quiz); setActiveMenu(null); }}
                          className="w-full px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                        >
                          Delete Quiz
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-20 text-center text-slate-400 italic">
                  No quizzes found. Click "+ Add New Quiz" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Drawer */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110]" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-[120] w-full max-w-md bg-white shadow-2xl p-8 animate-in slide-in-from-right duration-300">
             <div className="flex items-center justify-between mb-8 border-b pb-4 text-slate-800">
                <h2 className="text-xl font-bold">{editingQuiz ? 'Update Quiz' : 'Create New Quiz'}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
             </div>
             <form action={handleSubmit} className="space-y-6">
                <input type="hidden" name="existingImageUrl" value={editingQuiz?.imageUrl || ''} readOnly />
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Quiz Name</label>
                  <input name="title" defaultValue={editingQuiz?.title} placeholder="e.g. History Basics" className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Short Description</label>
                  <textarea name="description" defaultValue={editingQuiz?.description} rows={4} placeholder="What is this quiz about?" className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Quiz Cover Image</label>
                  {editingQuiz?.imageUrl ? (
                    <div className="relative w-full h-48 group rounded-xl overflow-hidden border border-slate-200 mb-3">
                      <img src={editingQuiz.imageUrl} className="w-full h-full object-cover" alt="Cover" />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            setAiSearchModal({ isOpen: true, query: editingQuiz?.title || '', results: [], provider: 'pexels', isSearching: false });
                            if (editingQuiz?.title) performImageSearch(editingQuiz.title, 'pexels');
                          }}
                          className="bg-white/90 text-indigo-600 p-2 rounded-full shadow-md hover:bg-white transition-all"
                          title="Find Replacement (AI)"
                        >
                          <span>✨</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditingQuiz({ ...editingQuiz, imageUrl: '' })}
                          className="bg-red-500 text-white p-2 rounded-full shadow-md hover:bg-red-600 transition-all"
                          title="Remove Image"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input type="file" name="imageFile" accept="image/*" className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all cursor-pointer" />
                      <div className="text-center text-xs text-slate-400 font-bold uppercase">OR</div>
                      <button 
                        type="button"
                        onClick={() => {
                          setAiSearchModal({ isOpen: true, query: editingQuiz?.title || '', results: [], provider: 'pexels', isSearching: false });
                          if (editingQuiz?.title) performImageSearch(editingQuiz.title, 'pexels');
                        }}
                        className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                      >
                        <span>✨</span> Find Cover Image
                      </button>
                    </div>
                  )}
                  {!editingQuiz?.imageUrl && <p className="mt-2 text-[10px] text-slate-400">Recommended: Square aspect ratio, under 1MB.</p>}
                </div>
                <div className="flex gap-4 pt-10">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Save Changes</button>
                  <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
                </div>
             </form>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[130]" onClick={() => setDeleteTarget(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-[140] p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Permanently Delete?</h3>
              <p className="text-slate-500 text-sm mb-8 italic">"{deleteTarget.title}"</p>
              <p className="text-slate-500 text-sm mb-8 uppercase text-xs font-bold tracking-tighter">This will also clear any question counts and analytics.</p>
            </div>
            <div className="flex gap-3">
              <button 
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  await deleteQuiz(deleteTarget.id, topicId);
                  await loadQuizzes();
                  setIsDeleting(false);
                  setDeleteTarget(null);
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Remove It'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
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
                className="flex-1 bg-slate-50 border-0 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
                placeholder="Search query..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && performImageSearch(aiSearchModal.query, aiSearchModal.provider)}
              />
              <button 
                onClick={() => performImageSearch(aiSearchModal.query, aiSearchModal.provider)}
                className="bg-indigo-600 text-white px-6 rounded-xl font-bold text-sm hover:bg-indigo-700"
              >
                Search
              </button>
            </div>

            <div className="flex gap-2 mb-6 border-b border-slate-100 pb-2">
              <button 
                onClick={() => performImageSearch(aiSearchModal.query, 'pexels')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${aiSearchModal.provider === 'pexels' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Pexels
              </button>
              <button 
                onClick={() => performImageSearch(aiSearchModal.query, 'wikimedia')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${aiSearchModal.provider === 'wikimedia' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Wikicommons
              </button>
            </div>

            {aiSearchModal.isSearching ? (
              <div className="py-10 text-center text-slate-400">Searching...</div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {aiSearchModal.results.map((img, idx) => (
                  <div key={idx} onClick={() => selectImage(img)} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden cursor-pointer hover:ring-4 ring-indigo-500 transition-all">
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
                className="px-6 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Global Menus Backdrop */}
      {activeMenu && <div className="fixed inset-0 z-[90]" onClick={() => setActiveMenu(null)} />}
    </div>
  );
}