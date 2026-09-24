'use client';

import {useRef, useState} from 'react';
import {useTranslations} from 'next-intl';

const snaps = [28, 55, 92];

export function BottomSheet({children, initial = 1, label}: {children: React.ReactNode; initial?: number; label: string}) {
  const productT = useTranslations('product');
  const [snap, setSnap] = useState(initial);
  const drag = useRef<{y: number; snap: number} | null>(null);
  function move(event: React.PointerEvent) {
    if (!drag.current) return;
    const delta = drag.current.y - event.clientY;
    if (delta > 55) setSnap(Math.min(2, drag.current.snap + 1));
    if (delta < -55) setSnap(Math.max(0, drag.current.snap - 1));
  }
  return <section className={`bottom-sheet snap-${snap}`} aria-label={label} data-snap={snaps[snap]}>
    <button type="button" className="sheet-handle" aria-label={productT('resizeSheet')}
      onPointerDown={event => { drag.current = {y: event.clientY, snap}; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={move} onPointerUp={() => { drag.current = null; }}>
      <span aria-hidden="true"/>
    </button>
    <div className="sheet-scroll">{children}</div>
  </section>;
}
