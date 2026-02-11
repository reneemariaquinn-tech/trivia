// src/components/ui/ModalConfirm.tsx
'use client';

interface ModalConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description: string;
  confirmText?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export default function ModalConfirm({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  description,
  confirmText = "Confirm",
  variant = 'danger',
  isLoading = false
}: ModalConfirmProps) {
  if (!isOpen) return null;

  const themes = {
    danger: "bg-red-600 hover:bg-red-700 shadow-red-100",
    primary: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
  };

  const icons = {
    danger: "⚠️",
    primary: "ℹ️"
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose} 
      />
      
      {/* Modal Card */}
      <div className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${variant === 'danger' ? 'bg-red-50' : 'bg-indigo-50'}`}>
          <span className="text-3xl">{icons[variant]}</span>
        </div>
        
        <h3 className="text-2xl font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 leading-relaxed">{description}</p>

        <div className="flex gap-3 mt-8">
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 text-white py-3 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 ${themes[variant]}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}