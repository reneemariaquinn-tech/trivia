'use client';

import { useEffect, useState } from 'react';
import { getCategories, deleteCategory, upsertCategory } from './actions';
import Link from 'next/link';
import { searchImages } from '../../actions';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Drawer & Edit States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

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

  useEffect(() => { loadCategories(); }, []);
  
  const loadCategories = async () => {
    const data = await getCategories();
    setCategories(data);
    setIsLoading(false);
  };

  // Helper: Resize image on client before upload
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);

    const file = formData.get('imageFile') as File;
    const MAX_SIZE = 1 * 1024 * 1024; // 1MB

    if (file && file.size > MAX_SIZE) {
      alert(`The image is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Please keep it under 1MB.`);
      setIsSaving(false);
      return;
    }

    // Client-side Upload
    if (file && file.size > 0) {
      const resizedBlob = await resizeImage(file);
      const storageRef = ref(storage, `trivia/topic-covers/${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.jpg`);
      await uploadBytes(storageRef, resizedBlob, { contentType: 'image/jpeg' });
      const downloadUrl = await getDownloadURL(storageRef);
      formData.set('existingImageUrl', downloadUrl); // Pass URL to server action
    }

    try {
      await upsertCategory(editingCategory?.id || null, formData);
      setIsDrawerOpen(false);
      loadCategories();
    } catch (error) {
      console.error("Submission failed:", error);
      alert("The server encountered an issue saving the category.");
    } finally {
      setIsSaving(false);
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
    setEditingCategory((prev: any) => ({ ...prev, imageUrl: img.url }));
    setAiSearchModal(prev => ({ ...prev, isOpen: false }));
  };

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto text-slate-700">
      {/* Search & Header */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Categories</h1>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Search..."
            className="bg-white border-0 shadow-sm rounded-lg px-6 py-2 text-sm w-72 focus:ring-2 focus:ring-[#5233a6] transition-all outline-none"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => { setEditingCategory(null); setIsDrawerOpen(true); }}
            className="bg-[#5233a6] hover:bg-[#3e2680] text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md shadow-[#5233a6]/20 transition-all"
          >
            + Add New
          </button>
        </div>
      </div>

      {/* Card-Style Table */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-visible">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white text-sm">
              <th className="p-5 text-white font-semibold text-sm first:rounded-tl-2xl">Image</th>
              <th className="p-5 text-white font-semibold text-sm">Category Name</th>
              <th className="p-5 text-white font-semibold text-sm">Description</th>
              <th className="p-5 text-white font-semibold text-sm text-center">Quizzes</th>
              <th className="p-5 text-white font-semibold text-sm text-right pr-10 last:rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((cat) => (
              <tr key={cat.id} className="hover:bg-[#5233a6]/5 transition-colors">
                <td className="p-5">
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} className="h-12 w-12 rounded-lg object-cover border-2 border-white shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase">No Img</div>
                  )}
                </td>
                <td className="p-5 font-bold text-slate-800">
                  <Link href={`/admin/topics/${cat.id}`} className="hover:text-[#5233a6] transition-colors">
                    {cat.name}
                  </Link>
                </td>
                <td className="p-5 text-sm text-slate-500 max-w-xs truncate">{cat.description}</td>
                <td className="p-5 text-center">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                    {cat.quizCount}
                  </span>
                </td>
                <td className="p-5 text-right pr-10 relative">
                  <button 
                    onClick={() => setActiveMenu(activeMenu === cat.id ? null : cat.id)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-slate-400 hover:text-[#5233a6] transition-all font-bold text-xl"
                  >
                    ⋮
                  </button>

                  {activeMenu === cat.id && (
                    <div className="absolute right-10 top-14 w-40 bg-white rounded-lg shadow-2xl ring-1 ring-black/5 z-[100] py-2 animate-in fade-in zoom-in-95 duration-100">
                      <button 
                        onClick={() => { setEditingCategory(cat); setIsDrawerOpen(true); setActiveMenu(null); }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-[#5233a6]/10 hover:text-[#5233a6]"
                      >
                        Edit Category
                      </button>
                      <button 
                        onClick={() => { setDeleteTarget(cat); setActiveMenu(null); }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50"
                      >
                        Delete Category
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Drawer */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110]" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-[120] w-full max-w-md bg-white shadow-2xl p-8 animate-in slide-in-from-right duration-300">
             <div className="flex items-center justify-between mb-8 border-b pb-4">
                <h2 className="text-xl font-bold text-slate-800">{editingCategory ? 'Update Category' : 'New Category'}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
             </div>
             <form onSubmit={handleSubmit} className="space-y-6">
                <input type="hidden" name="existingImageUrl" value={editingCategory?.imageUrl || ''} readOnly />
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Category Name</label>
                  <input name="name" defaultValue={editingCategory?.name} className="w-full bg-slate-50 border-0 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#5233a6]" required />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Description</label>
                  <textarea name="description" defaultValue={editingCategory?.description} rows={4} className="w-full bg-slate-50 border-0 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#5233a6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Image Asset</label>
                  {editingCategory?.imageUrl ? (
                    <div className="relative w-32 h-32 group">
                      <img 
                        src={editingCategory.imageUrl} 
                        alt="Category cover" 
                        className="w-full h-full object-cover rounded-lg border-2 border-slate-100 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingCategory({ ...editingCategory, imageUrl: '' })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 transition-all hover:scale-110"
                        title="Remove image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input type="file" name="imageFile" accept="image/*" className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-6 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#5233a6]/10 file:text-[#5233a6] hover:file:bg-[#5233a6]/20 transition-all" />
                      <div className="text-center text-xs text-slate-400 font-bold uppercase">OR</div>
                      <button 
                        type="button"
                        onClick={() => {
                          setAiSearchModal({ isOpen: true, query: editingCategory?.name || '', results: [], provider: 'pexels', isSearching: false });
                          if (editingCategory?.name) performImageSearch(editingCategory.name, 'pexels');
                        }}
                        className="w-full py-3 bg-[#5233a6]/10 text-[#5233a6] rounded-lg text-xs font-bold hover:bg-[#5233a6]/20 transition-all flex items-center justify-center gap-2"
                      >
                        <span>✨</span> Find Image with AI
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-4 pt-10">
                  <button type="submit" disabled={isSaving} className="flex-1 bg-[#5233a6] text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-[#5233a6]/20 hover:bg-[#3e2680] transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
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
              <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Category?</h3>
              <p className="text-slate-500 text-sm mb-8">Are you sure you want to delete <span className="font-bold text-slate-700">"{deleteTarget.name}"</span>? This cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button 
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  await deleteCategory(deleteTarget.id);
                  await loadCategories();
                  setIsDeleting(false);
                  setDeleteTarget(null);
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
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

      {/* Global Menus Backdrop */}
      {(activeMenu) && <div className="fixed inset-0 z-[90]" onClick={() => { setActiveMenu(null); }} />}
    </div>
  );
}