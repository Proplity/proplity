'use client';

import { useEffect } from 'react';

// On a phone a wide table either scrolls sideways with its right-hand columns cut off or
// squeezes into unreadable slivers. Under 640px (see globals.css) every table in the app
// area turns into one card per row, with each cell labelled by its column heading. The
// labels come from the table's own header cells, so no table needs its own markup.
function label(table: HTMLTableElement) {
  const heads = Array.from(table.querySelectorAll('thead th')).map((th) =>
    (th.textContent ?? '').trim(),
  );
  if (heads.length === 0) return;
  table.classList.add('stack-on-phone');
  table.querySelectorAll('tbody tr').forEach((row) => {
    let col = 0;
    Array.from(row.children).forEach((cell) => {
      if (!(cell instanceof HTMLElement) || cell.tagName !== 'TD') return;
      const span = Number(cell.getAttribute('colspan') ?? 1);
      if (span === 1 && heads[col] && cell.dataset.label !== heads[col]) {
        cell.dataset.label = heads[col];
      }
      col += span;
    });
  });
}

export function ResponsiveTables() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      document.querySelectorAll('main table').forEach((t) => label(t as HTMLTableElement));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
