import React, { useEffect, useRef } from 'react';

const DEG = Math.PI / 180;
const W = 36;
const DOT = 19;
const J = { a: 100, r: Math.max(32, W * 0.95), th: 105 * DEG };
const S = J.a + J.r * J.th;
const PHI = 150 * DEG;

function centerline(e = 1, N = 90) {
   const h0 = (90 * DEG) * (1 - e) + (180 * DEG - PHI / 2) * e;
   const kS = PHI / S;
   let x = 0;
   let y = 0;
   let h = h0;
   const pts = [[0, 0]];
   const ds = S / N;

   for (let i = 0; i < N; i++) {
      const s = (i + 0.5) * ds;
      const k = (s < J.a ? 0 : 1 / J.r) * (1 - e) + kS * e;
      h += k * ds / 2;
      x += Math.cos(h) * ds;
      y += Math.sin(h) * ds;
      h += k * ds / 2;
      pts.push([x, y]);
   }
   return pts;
}

const F = centerline(1);
let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
F.forEach((p) => {
   mnx = Math.min(mnx, p[0]);
   mxx = Math.max(mxx, p[0]);
   mny = Math.min(mny, p[1]);
   mxy = Math.max(mxy, p[1]);
});

const eyeUp = 46 + W * 0.4;
const CX = 150;
const CY = 162;
const faceTop = mny - eyeUp - DOT;
const faceH = mxy - faceTop;
const fx = CX - (mnx + mxx) / 2;
const fy = CY - faceTop - faceH / 2;
const span = F[0][0] - F[F.length - 1][0];
const EL = [fx + F[F.length - 1][0] + span * 0.17, fy + mny - eyeUp];
const ER = [fx + F[0][0] - span * 0.17, fy + mny - eyeUp];
const SMILE_PATH = 'M' + F.map((p) => `${(p[0] + fx).toFixed(1)} ${(p[1] + fy).toFixed(1)}`).join('L');

export default function JeitoSmile({
   className = 'w-28 h-28',
   mouthColor = '#FFFFFF',
   eyeColor = '#1F6BFF',
   animated = false,
   winkOnMount = false,
   ...props
}) {
   const svgRef = useRef(null);
   const eyeLRef = useRef(null);
   const eyeRRef = useRef(null);
   const winkScaleRef = useRef(1);

   useEffect(() => {
      if (!winkOnMount) return;

      const eR = eyeRRef.current;
      const svg = svgRef.current;
      if (!eR || !svg) return;

      const prefersReducedMotion =
         typeof window !== 'undefined' &&
         window.matchMedia &&
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      let rafId = null;
      const startDelay = setTimeout(() => {
         const t0 = performance.now();
         const totalMs = 420;
         function step(ts) {
            const elapsed = ts - t0;
            const p = Math.min(1, elapsed / totalMs);
            // Guiño: cierra ojo derecho (0..0.3), mantiene (0.3..0.65), abre (0.65..1)
            let scaleY = 1;
            let tilt = 0;
            if (p < 0.3) {
               const k = p / 0.3;
               scaleY = 1 - 0.88 * k;
               tilt = -4 * k;
            } else if (p < 0.65) {
               scaleY = 0.12;
               tilt = -4;
            } else {
               const k = (p - 0.65) / 0.35;
               scaleY = 0.12 + 0.88 * k;
               tilt = -4 * (1 - k);
            }
            winkScaleRef.current = scaleY;
            eR.setAttribute('ry', (DOT * scaleY).toFixed(2));
            svg.style.transform = `rotate(${tilt.toFixed(2)}deg)`;
            if (p < 1) {
               rafId = requestAnimationFrame(step);
            } else {
               winkScaleRef.current = 1;
               eR.setAttribute('ry', String(DOT));
               svg.style.transform = '';
            }
         }
         rafId = requestAnimationFrame(step);
      }, 220);

      return () => {
         clearTimeout(startDelay);
         if (rafId) cancelAnimationFrame(rafId);
         winkScaleRef.current = 1;
         svg.style.transform = '';
      };
   }, [winkOnMount]);

   useEffect(() => {
      if (!animated) return;

      const eL = eyeLRef.current;
      const eR = eyeRRef.current;
      const svg = svgRef.current;
      if (!eL || !eR || !svg) return;

      const prefersReducedMotion =
         typeof window !== 'undefined' &&
         window.matchMedia &&
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let look = [0, 0];
      let lookT = [0, 0];
      let blink = 1;
      let loopAnim = null;
      let blinkTimeout = null;

      function updateEyes() {
         const rx = ER[0] + look[0];
         const ry = ER[1] + look[1];
         eR.setAttribute('cx', rx.toFixed(1));
         eR.setAttribute('cy', ry.toFixed(1));
         eR.setAttribute('ry', (DOT * blink * winkScaleRef.current).toFixed(2));

         const lx = EL[0] + look[0];
         const ly = EL[1] + look[1];
         eL.setAttribute('cx', lx.toFixed(1));
         eL.setAttribute('cy', ly.toFixed(1));
         eL.setAttribute('ry', (DOT * blink).toFixed(2));
      }

      if (prefersReducedMotion) {
         updateEyes();
         return;
      }

      // 1. Movimiento del puntero: los ojos siguen el cursor suavemente
      const handlePointerMove = (ev) => {
         const r = svg.getBoundingClientRect();
         const centerX = r.left + r.width / 2;
         const centerY = r.top + r.height * 0.38;
         const dx = ev.clientX - centerX;
         const dy = ev.clientY - centerY;
         const d = Math.sqrt(dx * dx + dy * dy) || 1;
         // En el SVG viewBox (230x230), con tamaño rendered 112px-128px,
         // un desplazamiento de 14 unidades representa ~8-9px visibles de movimiento.
         const maxDistance = 14;
         const m = Math.min(maxDistance, d / 22);
         lookT = [(dx / d) * m, (dy / d) * m];
      };

      window.addEventListener('pointermove', handlePointerMove, { passive: true });

      function loop() {
         look[0] += (lookT[0] - look[0]) * 0.18;
         look[1] += (lookT[1] - look[1]) * 0.18;
         updateEyes();
         loopAnim = requestAnimationFrame(loop);
      }
      loopAnim = requestAnimationFrame(loop);

      // 2. Parpadeo periódico natural cada 2.5s a 5s
      function scheduleBlink() {
         blinkTimeout = setTimeout(() => {
            const t0 = performance.now();
            function b(ts) {
               const p = (ts - t0) / 180;
               blink = p < 1 ? Math.abs(1 - 2 * p) * 0.92 + 0.08 : 1;
               updateEyes();
               if (p < 1) requestAnimationFrame(b);
            }
            requestAnimationFrame(b);
            scheduleBlink();
         }, 2600 + Math.random() * 2400);
      }
      scheduleBlink();

      // 3. Clic para un guiño/parpadeo interactivo
      const handleClick = () => {
         const t0 = performance.now();
         function b(ts) {
            const p = (ts - t0) / 160;
            blink = p < 1 ? Math.abs(1 - 2 * p) * 0.92 + 0.08 : 1;
            updateEyes();
            if (p < 1) requestAnimationFrame(b);
         }
         requestAnimationFrame(b);
      };

      svg.addEventListener('click', handleClick);

      return () => {
         clearTimeout(blinkTimeout);
         cancelAnimationFrame(loopAnim);
         window.removeEventListener('pointermove', handlePointerMove);
         svg.removeEventListener('click', handleClick);
      };
   }, [animated]);

   if (!animated && !winkOnMount) {
      return (
         <svg
            className={className}
            aria-hidden="true"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="35 35 230 230"
            {...props}
         >
            <path
               d={SMILE_PATH}
               fill="none"
               stroke={mouthColor}
               strokeWidth="36"
               strokeLinecap="round"
               strokeLinejoin="round"
            />
            <ellipse cx={EL[0].toFixed(1)} cy={EL[1].toFixed(1)} rx={DOT} ry={DOT} fill={eyeColor} />
            <ellipse cx={ER[0].toFixed(1)} cy={ER[1].toFixed(1)} rx={DOT} ry={DOT} fill={eyeColor} />
         </svg>
      );
   }

   return (
      <svg
         ref={svgRef}
         className={`${className} select-none ${animated ? 'cursor-pointer transition-transform active:scale-95' : ''}`}
         aria-label="Carita sonriente Jeito"
         role="img"
         xmlns="http://www.w3.org/2000/svg"
         viewBox="35 35 230 230"
         title="Carita Jeito"
         {...props}
      >
         <path
            d={SMILE_PATH}
            fill="none"
            stroke={mouthColor}
            strokeWidth="36"
            strokeLinecap="round"
            strokeLinejoin="round"
         />
         <ellipse ref={eyeLRef} fill={eyeColor} rx={DOT} ry={DOT} cx={EL[0].toFixed(1)} cy={EL[1].toFixed(1)} />
         <ellipse ref={eyeRRef} fill={eyeColor} rx={DOT} ry={DOT} cx={ER[0].toFixed(1)} cy={ER[1].toFixed(1)} />
      </svg>
   );
}
