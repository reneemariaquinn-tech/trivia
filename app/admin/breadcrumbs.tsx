'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export default function Breadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = pathname.split('/').filter((segment) => segment);

  const crumbs = [
    { label: 'Admin', href: '/admin' }
  ];

  const topicsIndex = segments.indexOf('topics');
  const quizzesIndex = segments.indexOf('quizzes');

  if (topicsIndex !== -1) {
    // Path is /admin/topics or /admin/topics/[id]
    crumbs.push({ label: 'Topics', href: '/admin/topics' });
    if (topicsIndex < segments.length - 1) {
      // Path is /admin/topics/[id], which shows quizzes for a topic
      crumbs.push({ label: 'Quizzes', href: pathname });
    }
  } else if (quizzesIndex !== -1) {
    // Path is /admin/quizzes/[id], which shows questions for a quiz
    const topicId = searchParams.get('topicId');
    crumbs.push({ label: 'Topics', href: '/admin/topics' });
    if (topicId) {
      crumbs.push({ label: 'Quizzes', href: `/admin/topics/${topicId}` });
    }
    crumbs.push({ label: 'Questions', href: pathname });
  }

  return (
    <nav aria-label="Breadcrumb" className="bg-white border-b border-slate-200 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <ol className="flex items-center space-x-2 text-sm text-slate-600">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={index} className="flex items-center">
                {index > 0 && <span className="mx-2 text-slate-400">/</span>}
                {isLast ? (
                  <span className="font-medium text-slate-900" aria-current="page">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-[#5233a6] transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}