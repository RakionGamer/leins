import React, { useEffect, useRef } from 'react';

const DEG = Math.PI / 180;
const W = 36;
const DOT = 19;
const J = { a: 100, r: Math.max(32, W * 0.95), th: 105 * DEG };
const S = J.a + J.r * J.th;
const PHI = 150 * DEG;

function ease(t) {
   return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function centerline(e, N = 90) {
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
const JX = CX + 16;
const JY = CY - 58;
const JDOT = [JX, JY - W / 2 - 14 - DOT];

export default function JeitoSmile({
   className = 'w-28 h-28',
   mouthColor = '#FFFFFF',
   eyeColor = '#1F6BFF',
   animated = false,
   ...props
}) {
   const svgRef = useRef(null);
   const strokeRef = useRef(null);
   const eyeLRef = useRef(null);
   const eyeRRef = useRef(null);

   useEffect(() => {
      if (!animated) return;

      const stroke = strokeRef.current;
      const eL = eyeLRef.current;
      const eR = eyeRRef.current;
      const svg = svgRef.current;
      if (!stroke || !eL || !eR || !svg) return;

      const prefersReducedMotion =
         typeof window !== 'undefined' &&
         window.matchMedia &&
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let look = [0, 0];
      let lookT = [0, 0];
      let blink = 1;
      let tState = 0;
      let anim = null;
      let loopAnim = null;
      let blinkTimeout = null;
      let busy = false;

      function updateEyes(e = ease(tState)) {
         const rx = JDOT[0] * (1 - e) + ER[0] * e + look[0] * e;
         const ry = JDOT[1] * (1 - e) + ER[1] * e + look[1] * e;
         eR.setAttribute('cx', rx.toFixed(1));
         eR.setAttribute('cy', ry.toFixed(1));

         const a = Math.max(0, Math.min(1, (e - 0.45) / 0.4));
         eL.setAttribute('cx', (EL[0] + look[0] * e).toFixed(1));
         eL.setAttribute('cy', (EL[1] + look[1] * e).toFixed(1));
         eL.setAttribute('rx', (DOT * a).toFixed(2));
         eL.setAttribute('ry', (DOT * a * blink).toFixed(2));
         eR.setAttribute('ry', (DOT * (e > 0.5 ? blink : 1)).toFixed(2));
      }

      function draw(t) {
         tState = t;
         const e = ease(t);
         const pts = centerline(e);
         const ox = JX * (1 - e) + fx * e;
         const oy = JY * (1 - e) + fy * e;

         stroke.setAttribute(
            'd',
            'M' + pts.map((p) => `${(p[0] + ox).toFixed(1)} ${(p[1] + oy).toFixed(1)}`).join('L')
         );

         updateEyes(e);
      }

      function tween(from, to, dur, done) {
         let t0 = null;
         cancelAnimationFrame(anim);
         function step(ts) {
            if (t0 === null) t0 = ts;
            const p = Math.min(1, (ts - t0) / dur);
            draw(from + (to - from) * p);
            if (p < 1) {
               anim = requestAnimationFrame(step);
            } else {
               anim = null;
               if (done) done();
            }
         }
         anim = requestAnimationFrame(step);
      }

      if (prefersReducedMotion) {
         draw(1);
         return;
      }

      // 1. Estado inicial: parte como 'j' y se transforma en carita sonriente
      draw(0);
      const startTimer = setTimeout(() => {
         tween(0, 1, 1300);
      }, 500);

      // 2. Movimiento: los ojos siguen suavemente el cursor por toda la pantalla
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
         if (!anim && tState > 0.5) {
            updateEyes();
         }
         loopAnim = requestAnimationFrame(loop);
      }
      loopAnim = requestAnimationFrame(loop);

      // 3. Parpadeo periódico natural cada 2.5s a 5s
      function scheduleBlink() {
         blinkTimeout = setTimeout(() => {
            if (tState > 0.9) {
               const t0 = performance.now();
               function b(ts) {
                  const p = (ts - t0) / 180;
                  blink = p < 1 ? Math.abs(1 - 2 * p) * 0.92 + 0.08 : 1;
                  if (!anim && tState > 0.5) updateEyes();
                  if (p < 1) requestAnimationFrame(b);
               }
               requestAnimationFrame(b);
            }
            scheduleBlink();
         }, 2600 + Math.random() * 2400);
      }
      scheduleBlink();

      // 4. Interacción al hacer clic: vuelve a ser 'j' y vuelve a sonreír
      const handleClick = () => {
         if (busy) return;
         busy = true;
         tween(tState, 0, 650, () => {
            setTimeout(() => {
               tween(0, 1, 1000, () => {
                  busy = false;
               });
            }, 200);
         });
      };

      svg.addEventListener('click', handleClick);

      return () => {
         clearTimeout(startTimer);
         clearTimeout(blinkTimeout);
         cancelAnimationFrame(anim);
         cancelAnimationFrame(loopAnim);
         window.removeEventListener('pointermove', handlePointerMove);
         svg.removeEventListener('click', handleClick);
      };
   }, [animated]);

   if (!animated) {
      const e = 1;
      const pts = centerline(e);
      const ox = fx;
      const oy = fy;
      const d = 'M' + pts.map((p) => `${(p[0] + ox).toFixed(1)} ${(p[1] + oy).toFixed(1)}`).join('L');

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
               d={d}
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
         className={`${className} cursor-pointer select-none transition-transform active:scale-95`}
         aria-label="Carita sonriente Jeito"
         role="img"
         xmlns="http://www.w3.org/2000/svg"
         viewBox="35 35 230 230"
         title="Haz clic en la carita"
         {...props}
      >
         <path
            ref={strokeRef}
            fill="none"
            stroke={mouthColor}
            strokeWidth="36"
            strokeLinecap="round"
            strokeLinejoin="round"
         />
         <ellipse ref={eyeLRef} fill={eyeColor} rx="0" ry="0" cx={EL[0].toFixed(1)} cy={EL[1].toFixed(1)} />
         <ellipse ref={eyeRRef} fill={eyeColor} rx={DOT} ry={DOT} cx={JDOT[0].toFixed(1)} cy={JDOT[1].toFixed(1)} />
      </svg>
   );
}
