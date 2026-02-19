'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(p => p);
  
  // Base crumb
  const crumbs = [
    { label: 'Admin', href: '/admin/topics' }
  ];

  // Logic to build breadcrumbs based on path
  if (segments.includes('topics')) {
     crumbs.push({ label: 'Categories', href: '/admin/topics' });
     // If we are deeper than /admin/topics (e.g. /admin/topics/123)
     if (segments.length > 2 && segments[1] === 'topics') {
       crumbs.push({ label: 'Category Quizzes', href: '#' });
     }
  } else if (segments.includes('quizzes')) {
     // Quizzes are accessed from Categories, so we link back to Categories
     crumbs.push({ label: 'Categories', href: '/admin/topics' });
     crumbs.push({ label: 'Quiz Questions', href: '#' });
  }

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm sticky top-[60px] z-40">
      <div className="max-w-7xl mx-auto flex items-center text-sm text-slate-500">
        {crumbs.map((crumb, idx) => (
          <div key={idx} className="flex items-center">
            {idx > 0 && <span className="mx-2 text-slate-300">/</span>}
            {idx === crumbs.length - 1 ? (
              <span className="font-semibold text-[#5233a6]">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-[#5233a6] transition-colors">{crumb.label}</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}