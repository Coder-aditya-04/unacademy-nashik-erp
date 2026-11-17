import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts from the previous value (0 on first show) up to `target` with an
// ease-out curve. Returns the target straight away under reduced motion.
export const useCountUp = (target, duration = 900) => {
    const end = Number(target) || 0;
    const [shown, setShown] = useState(reduced() ? end : 0);
    // Where the number currently is, so a new target continues from there.
    const current = useRef(reduced() ? end : 0);
    useEffect(() => {
        if (reduced()) { setShown(end); current.current = end; return undefined; }
        const start = performance.now();
        const begin = current.current;
        let raf;
        const tick = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const v = begin + (end - begin) * (1 - Math.pow(1 - p, 3));
            current.current = v;
            setShown(v);
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [end, duration]);
    return shown;
};
