'use client';

import { useEffect, useState } from 'react';
import { getCategories, deleteCategory, upsertCategory } from './actions';
import Link from 'next/link';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drawer & Edit States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  // Delete Modal States
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { loadCategories(); }, []);
  
  const loadCategories = async () => {
    const data = await getCategories();
    setCategories(data);
    setIsLoading(false);
  };

  const handleSubmit = async (formData: FormData) => {
    const file = formData.get('imageFile') as File;
    const MAX_SIZE = 1 * 1024 * 1024; // 1MB

    if (file && file.size > MAX_SIZE) {
      alert(`The image is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Please keep it under 1MB.`);
      return;
    }

    try {
      await upsertCategory(editingCategory?.id || null, formData);
      setIsDrawerOpen(false);
      loadCategories();
    } catch (error) {
      console.error("Submission failed:", error);
      alert("The server encountered an issue saving the category.");
    }
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
    <div className="p-10 max-w-7xl mx-auto bg-slate-50 min-h-screen text-slate-700">
      {/* Search & Header */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Categories</h1>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Search..."
            className="bg-white border-0 shadow-sm rounded-full px-6 py-2 text-sm w-72 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => { setEditingCategory(null); setIsDrawerOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full text-sm font-bold shadow-md shadow-indigo-200 transition-all"
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
              <tr key={cat.id} className="hover:bg-indigo-50/30 transition-colors">
                <td className="p-5">
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} className="h-12 w-12 rounded-xl object-cover border-2 border-white shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase">No Img</div>
                  )}
                </td>
                <td className="p-5 font-bold text-slate-800">
                  <Link href={`/admin/topics/${cat.id}`} className="hover:text-indigo-600 transition-colors">
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
                    className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm text-slate-400 hover:text-indigo-600 transition-all font-bold text-xl"
                  >
                    ⋮
                  </button>

                  {activeMenu === cat.id && (
                    <div className="absolute right-10 top-14 w-40 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 z-[100] py-2 animate-in fade-in zoom-in-95 duration-100">
                      <button 
                        onClick={() => { setEditingCategory(cat); setIsDrawerOpen(true); setActiveMenu(null); }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
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
             <form action={handleSubmit} className="space-y-6">
                <input type="hidden" name="existingImageUrl" value={editingCategory?.imageUrl || ''} readOnly />
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Category Name</label>
                  <input name="name" defaultValue={editingCategory?.name} className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Description</label>
                  <textarea name="description" defaultValue={editingCategory?.description} rows={4} className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Image Asset</label>
                  {editingCategory?.imageUrl ? (
                    <div className="relative w-32 h-32 group">
                      <img 
                        src={editingCategory.imageUrl} 
                        alt="Category cover" 
                        className="w-full h-full object-cover rounded-xl border-2 border-slate-100 shadow-sm"
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
                    <input type="file" name="imageFile" accept="image/*" className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all" />
                  )}
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
              <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Category?</h3>
              <p className="text-slate-500 text-sm mb-8">Are you sure you want to delete <span className="font-bold text-slate-700">"{deleteTarget.title}"</span>? This cannot be undone.</p>
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
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Global Menus Backdrop */}
      {(activeMenu) && <div className="fixed inset-0 z-[90]" onClick={() => { setActiveMenu(null); }} />}
    </div>
  );
}