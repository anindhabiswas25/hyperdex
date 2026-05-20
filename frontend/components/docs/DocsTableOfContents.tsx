'use client';

import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function DocsTableOfContents() {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState('');

  /* Collect headings from the page */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.docs-content h2[id], .docs-content h3[id]'));
    const items: TocItem[] = els.map(el => ({
      id: el.id,
      text: el.textContent ?? '',
      level: el.tagName === 'H2' ? 2 : 3,
    }));
    setHeadings(items);
  }, []);

  /* Track which heading is in view */
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="docs-toc hidden xl:block w-[200px] shrink-0">
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pl-4 pr-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted/50 mb-4">
          On this page
        </p>
        <nav className="space-y-1">
          {headings.map(h => (
            <a
              key={h.id}
              href={`#${h.id}`}
              className={`docs-toc-item block text-[12px] leading-snug py-1 transition-all duration-150 ${
                h.level === 3 ? 'pl-4' : 'pl-0'
              } ${
                activeId === h.id
                  ? 'text-lavender-deep font-semibold'
                  : 'text-ink-muted/60 hover:text-ink-muted'
              }`}
            >
              {h.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
