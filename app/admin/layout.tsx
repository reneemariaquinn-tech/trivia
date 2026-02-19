import { Poppins } from 'next/font/google';
import Breadcrumbs from './breadcrumbs';
import { Suspense } from 'react';

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${poppins.className} bg-slate-50 min-h-screen text-slate-900`}>
      <header className="bg-[#5233a6] text-white py-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-4">
          {/* Placeholder Logo: Replace with SVG from game.tsx footer */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33.14 24.55" className="h-10 w-auto">
                  <path id="sparkle" fill="#66e0e0" d="M6.04,12.08l-.91-1.67c-.8-1.46-1.99-2.66-3.46-3.46l-1.67-.91,1.67-.91c1.46-.8,2.66-1.99,3.46-3.46l.91-1.67,.91,1.67c.8,1.46,1.99,2.66,3.46,3.46l1.67,.91-1.67,.91c-1.46,.8-2.66,1.99-3.46,3.46l-.91,1.67ZM3.55,6.04c.97,.68,1.81,1.53,2.49,2.49,.68-.97,1.53-1.81,2.49-2.49-.97-.68-1.81-1.53-2.49-2.49-.68,.97-1.53,1.81-2.49,2.49Z" />
                  <g id="text" fill="white">
                    <path d="M16.77,8.35c-.32-.04-.64-.07-.97-.07-4.2,0-7.61,3.41-7.61,7.61v8.32h2.62V15.89c0-2.76,2.24-5,5-5,.33,0,.66,.03,.97,.1v-2.64Z" />
                    <path d="M19.96,17.34c.4,2.9,2.74,4.67,6.28,4.67,2.3,0,4.31-.73,5.78-2.14h.13v2.87c-1.4,1.14-3.54,1.8-5.98,1.8-5.51,0-9.08-3.24-9.08-8.15s3.37-8.15,8.15-8.15,7.91,2.97,7.91,7.51v1.57h-13.19Zm0-2.37h10.55c-.4-2.54-2.4-4.17-5.24-4.17-2.67,0-4.77,1.67-5.31,4.17Z" />
                  </g>
                </svg>
          <h1 className="text-2xl font-bold text-white/90">Trivia Pro</h1>
        </div>
      </header>
<nav>
    <Suspense fallback={<div className="h-6 w-32 animate-pulse bg-gray-200" />}>
      <Breadcrumbs />
    </Suspense>
  </nav>
      <main>{children}</main>
    </div>
  );
}