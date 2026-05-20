'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ALL_PAGES } from './DocsSidebar';

export default function DocsPageNav() {
  const pathname = usePathname();
  const currentSlug = pathname === '/docs' || pathname === '/docs/'
    ? 'introduction'
    : pathname.replace('/docs/', '');

  const currentIndex = ALL_PAGES.findIndex(p => p.slug === currentSlug);
  const prev = currentIndex > 0 ? ALL_PAGES[currentIndex - 1] : null;
  const next = currentIndex < ALL_PAGES.length - 1 ? ALL_PAGES[currentIndex + 1] : null;

  return (
    <div className="docs-page-nav flex items-stretch gap-4 mt-16 pt-8 border-t border-black/8">
      {/* Previous */}
      {prev ? (
        <Link
          href={prev.slug === 'introduction' ? '/docs' : `/docs/${prev.slug}`}
          className="docs-page-nav-link group flex-1 flex flex-col gap-1 p-4 rounded-xl border border-black/8 bg-white hover:bg-lavender/20 hover:border-lavender-mid/40 transition-all duration-200"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/50 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-40 group-hover:opacity-70 transition-opacity -translate-x-0 group-hover:-translate-x-0.5">
              <path d="M7.5 2.5L4 6L7.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Previous
          </span>
          <span className="text-sm font-semibold text-ink group-hover:text-lavender-deep transition-colors">{prev.label}</span>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      {/* Next */}
      {next ? (
        <Link
          href={next.slug === 'introduction' ? '/docs' : `/docs/${next.slug}`}
          className="docs-page-nav-link group flex-1 flex flex-col gap-1 p-4 rounded-xl border border-black/8 bg-white hover:bg-lavender/20 hover:border-lavender-mid/40 transition-all duration-200 text-right items-end"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted/50 flex items-center gap-1">
            Next
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-40 group-hover:opacity-70 transition-opacity translate-x-0 group-hover:translate-x-0.5">
              <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-ink group-hover:text-lavender-deep transition-colors">{next.label}</span>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
