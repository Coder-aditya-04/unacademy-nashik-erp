import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts from the previous value (0 on first show) up to `target` with an
// ease-out curve, like the canvas. Under reduced motion it still counts, a
// little faster, because the numbers rolling up is part of the switch.
export const useCountUp = (target, duration = 900) => {
    const end = Number(target) || 0;
    const [shown, setShown] = useState(0);
    // Where the number currently is, so a new target continues from there.
    const current = useRef(0);
    useEffect(() => {
        const time = reduced() ? Math.round(duration * 0.6) : duration;
        const start = performance.now();
        const begin = current.current;
        let raf;
        const tick = (now) => {
            const p = Math.min(1, (now - start) / time);
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
