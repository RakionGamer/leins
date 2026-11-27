import React, { useEffect, useRef } from 'react';

const DEG = Math.PI / 180;
const J_STROKE = 36.78;
const J_DOT_R = 20.35;
const J_DOT_X = 48.39;
const J_DOT_Y = -135.85;

// Parámetros de la curva J / Smile en coordenadas del viewBox de JeitoLogo
const MORPH_A = 86.7;
const MORPH_R = 34.94;
const MORPH_TH = 105 * DEG;
const MORPH_S = MORPH_A + MORPH_R * MORPH_TH;
const MORPH_PHI = 150 * DEG;

function computeMorphFrame(e) {
   const N = 90;
   const h0 = (90 * DEG) * (1 - e) + (180 * DEG - MORPH_PHI / 2) * e;
   const kS = MORPH_PHI / MORPH_S;
   let x = 0;
   let y = 0;
   let h = h0;
   const pts = [[0, 0]];
   const ds = MORPH_S / N;

   for (let i = 0; i < N; i++) {
      const s = (i + 0.5) * ds;
      const k = (s < MORPH_A ? 0 : 1 / MORPH_R) * (1 - e) + kS * e;
      h += (k * ds) / 2;
      x += Math.cos(h) * ds;
      y += Math.sin(h) * ds;
      h += (k * ds) / 2;
      pts.push([x, y]);
   }

   // Desplazamiento base en e=0 para alinear exactamente con la J del logo (inicio en 48.39, -81.61)
   let mnx = 1e9, mxx = -1e9, mny = 1e9;
   pts.forEach((p) => {
      mnx = Math.min(mnx, p[0]);
      mxx = Math.max(mxx, p[0]);
      mny = Math.min(mny, p[1]);
   });

   // En e=0: el punto inicial (0,0) está en (48.39, -81.61)
   // En e=1: centramos la carita en X=218 (centro del viewBox) y Y=-28
   const smileCx = 218;
   const smileCy = -28;
   const smileFx = smileCx - (mnx + mxx) / 2;
   const smileFy = smileCy - mny;

   const fx = 48.39 * (1 - e) + smileFx * e;
   const fy = -81.61 * (1 - e) + smileFy * e;

   const pathD = 'M' + pts.map((p) => `${(p[0] + fx).toFixed(2)} ${(p[1] + fy).toFixed(2)}`).join('L');

   // Posición de los ojos cuando e=1 (carita centrada en smileCx)
   const smileEyeY = smileCy - 72;
   const eyeSpread = 34;
   const eyeLX = smileCx - eyeSpread;
   const eyeRX = smileCx + eyeSpread;

   // El ojo derecho se convierte en el punto azul de la J (48.39, -135.85)
   const dotX = J_DOT_X * (1 - e) + eyeRX * e;
   const dotY = J_DOT_Y * (1 - e) + smileEyeY * e;

   return {
      pathD,
      dotX,
      dotY,
      eyeLX,
      eyeLY: smileEyeY,
   };
}

export default function JeitoLogo({
   className = 'w-32',
   dotColor = '#1F6BFF',
   textColor = 'currentColor',
   morphFromSmile = false,
   ...props
}) {
   const jPathRef = useRef(null);
   const jDotRef = useRef(null);
   const leftEyeRef = useRef(null);
   const wordmarkRef = useRef(null);
   const iDotRef = useRef(null);

   useEffect(() => {
      if (!morphFromSmile) return;

      const prefersReducedMotion =
         typeof window !== 'undefined' &&
         window.matchMedia &&
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      const jPath = jPathRef.current;
      const jDot = jDotRef.current;
      const leftEye = leftEyeRef.current;
      const wordmark = wordmarkRef.current;
      const iDot = iDotRef.current;
      if (!jPath || !jDot || !leftEye || !wordmark || !iDot) return;

      let rafId = null;
      const tStart = performance.now();
      const holdSmileMs = 260;
      const morphMs = 680;

      function applyState(e, blinkScale = 1) {
         const frame = computeMorphFrame(e);
         jPath.setAttribute('d', frame.pathD);
         jDot.setAttribute('cx', frame.dotX.toFixed(2));
         jDot.setAttribute('cy', frame.dotY.toFixed(2));
         jDot.setAttribute('ry', (J_DOT_R * blinkScale).toFixed(2));
         jDot.setAttribute('rx', J_DOT_R.toFixed(2));

         leftEye.setAttribute('cx', frame.eyeLX.toFixed(2));
         leftEye.setAttribute('cy', frame.eyeLY.toFixed(2));
         leftEye.setAttribute('ry', (J_DOT_R * blinkScale).toFixed(2));
         leftEye.setAttribute('opacity', Math.max(0, Math.min(1, (e - 0.15) / 0.85)).toFixed(3));

         const wordOpacity = Math.max(0, Math.min(1, 1 - e * 1.15));
         const shiftX = -22 * e;
         wordmark.style.opacity = wordOpacity.toFixed(3);
         wordmark.setAttribute('transform', `translate(${(70.79 + shiftX).toFixed(2)} 0)`);
         iDot.style.opacity = wordOpacity.toFixed(3);
         iDot.setAttribute('cx', (214.48 + shiftX).toFixed(2));
      }

      // Estado inicial: carita completa
      applyState(1, 1);

      function tick(now) {
         const elapsed = now - tStart;

         if (elapsed < holdSmileMs) {
            // Pequeño parpadeo alegre mientras es carita
            const bp = elapsed / holdSmileMs;
            const blink = bp > 0.2 && bp < 0.85
               ? 0.15 + 0.85 * Math.abs(1 - 2 * ((bp - 0.2) / 0.65))
               : 1;
            applyState(1, blink);
            rafId = requestAnimationFrame(tick);
            return;
         }

         const mp = Math.min(1, (elapsed - holdSmileMs) / morphMs);
         // Ease cubic in-out
         const eased = mp < 0.5 ? 4 * mp * mp * mp : 1 - Math.pow(-2 * mp + 2, 3) / 2;
         const e = 1 - eased;

         applyState(e, 1);

         if (mp < 1) {
            rafId = requestAnimationFrame(tick);
         } else {
            // Asegurar estado final exacto de JeitoLogo
            leftEye.setAttribute('opacity', '0');
            wordmark.style.opacity = '1';
            wordmark.setAttribute('transform', 'translate(70.79 0)');
            iDot.style.opacity = '1';
            iDot.setAttribute('cx', '214.48');
         }
      }

      rafId = requestAnimationFrame(tick);

      return () => {
         if (rafId) cancelAnimationFrame(rafId);
      };
   }, [morphFromSmile]);

   return (
      <svg
         className={className}
         style={{ display: 'block', '--logo-dot': dotColor }}
         aria-hidden="true"
         focusable="false"
         xmlns="http://www.w3.org/2000/svg"
         viewBox="-33.32 -176.2 503.03 254.6"
         {...props}
      >
         <path
            ref={jPathRef}
            d="M48.39 -81.61L48.39 -79.94L48.39 -78.28L48.39 -76.61L48.39 -74.94L48.39 -73.28L48.39 -71.61L48.39 -69.94L48.39 -68.28L48.39 -66.61L48.39 -64.94L48.39 -63.27L48.39 -61.61L48.39 -59.94L48.39 -58.27L48.39 -56.61L48.39 -54.94L48.39 -53.27L48.39 -51.61L48.39 -49.94L48.39 -48.27L48.39 -46.61L48.39 -44.94L48.39 -43.27L48.39 -41.60L48.39 -39.94L48.39 -38.27L48.39 -36.60L48.39 -34.94L48.39 -33.27L48.39 -31.60L48.39 -29.94L48.39 -28.27L48.39 -26.60L48.39 -24.93L48.39 -23.27L48.39 -21.60L48.39 -19.93L48.39 -18.27L48.39 -16.60L48.39 -14.93L48.39 -13.27L48.39 -11.60L48.39 -9.93L48.39 -8.26L48.39 -6.60L48.39 -4.93L48.39 -3.26L48.39 -1.60L48.39 0.07L48.39 1.74L48.39 3.40L48.39 5.07L48.35 6.74L48.23 8.40L48.03 10.06L47.75 11.70L47.40 13.33L46.97 14.94L46.46 16.52L45.87 18.09L45.22 19.62L44.49 21.12L43.69 22.58L42.82 24.00L41.88 25.38L40.88 26.71L39.82 28.00L38.69 29.23L37.51 30.41L36.28 31.52L34.99 32.58L33.65 33.58L32.27 34.51L30.84 35.37L29.38 36.17L27.88 36.89L26.34 37.55L24.78 38.12L23.19 38.63L21.58 39.05L19.95 39.40L18.30 39.67L16.65 39.87L14.98 39.98L13.32 40.01L11.65 39.97L9.99 39.84L8.33 39.64L6.69 39.35L5.06 38.99"
            fill="none"
            stroke={textColor}
            strokeWidth={J_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
         />
         <g ref={wordmarkRef} transform="translate(70.79 0)" fill={textColor}>
            <path d="M66.12 2.27Q47.52 2.27 33.99 -4.24Q20.45 -10.74 13.22 -22.73Q5.99 -34.71 5.99 -51.03Q5.99 -66.74 12.91 -78.62Q19.83 -90.50 31.92 -97.21Q44.01 -103.93 59.50 -103.93Q70.87 -103.93 80.17 -100.31Q89.46 -96.69 96.07 -89.77Q102.69 -82.85 106.10 -73.14Q109.50 -63.43 109.50 -51.45Q109.50 -47.31 107.23 -45.35Q104.96 -43.39 100.00 -43.39L36.78 -43.39L36.78 -60.74L82.64 -60.74L79.34 -58.06Q79.34 -65.70 77.27 -70.45Q75.21 -75.21 71.18 -77.69Q67.15 -80.17 61.16 -80.17Q54.75 -80.17 50.10 -77.17Q45.45 -74.17 42.98 -68.39Q40.50 -62.60 40.50 -53.93L40.50 -52.07Q40.50 -37.40 47.00 -31.10Q53.51 -24.79 67.15 -24.79Q71.69 -24.79 77.58 -25.93Q83.47 -27.07 88.84 -29.13Q94.21 -31.20 98.14 -29.86Q102.07 -28.51 104.24 -25.31Q106.40 -22.11 106.61 -18.08Q106.82 -14.05 104.75 -10.23Q102.69 -6.40 97.93 -4.34Q90.70 -1.03 82.54 0.62Q74.38 2.27 66.12 2.27Z" />
            <path d="M143.60 1.86Q134.92 1.86 130.17 -3.31Q125.41 -8.47 125.41 -18.18L125.41 -83.47Q125.41 -93.18 130.17 -98.35Q134.92 -103.51 143.60 -103.51Q152.48 -103.51 157.33 -98.35Q162.19 -93.18 162.19 -83.47L162.19 -18.18Q162.19 -8.47 157.44 -3.31Q152.69 1.86 143.60 1.86Z" />
            <path d="M236.78 2.27Q221.28 2.27 211.26 -2.48Q201.24 -7.23 196.28 -16.84Q191.32 -26.45 191.32 -40.91L191.32 -74.59L184.30 -74.59Q177.69 -74.59 174.07 -78.10Q170.45 -81.61 170.45 -88.22Q170.45 -94.83 174.07 -98.24Q177.69 -101.65 184.30 -101.65L191.32 -101.65L191.32 -114.46Q191.32 -123.55 196.07 -128.31Q200.83 -133.06 209.71 -133.06Q218.60 -133.06 223.35 -128.31Q228.10 -123.55 228.10 -114.46L228.10 -101.65L245.04 -101.65Q251.86 -101.65 255.48 -98.24Q259.09 -94.83 259.09 -88.22Q259.09 -81.61 255.48 -78.10Q251.86 -74.59 245.04 -74.59L228.10 -74.59L228.10 -42.15Q228.10 -34.50 231.71 -30.89Q235.33 -27.27 243.18 -27.27Q246.07 -27.27 248.76 -27.89Q251.45 -28.51 253.72 -28.51Q257.02 -28.72 259.09 -26.55Q261.16 -24.38 261.16 -16.74Q261.16 -10.54 259.30 -6.30Q257.44 -2.07 252.69 -0.21Q249.79 0.83 244.83 1.55Q239.88 2.27 236.78 2.27Z" />
            <path d="M322.93 2.27Q305.99 2.27 293.39 -4.13Q280.79 -10.54 273.76 -22.52Q266.74 -34.50 266.74 -50.83Q266.74 -63.22 270.66 -73.04Q274.59 -82.85 282.02 -89.77Q289.46 -96.69 299.79 -100.31Q310.12 -103.93 322.93 -103.93Q339.88 -103.93 352.48 -97.52Q365.08 -91.12 372.00 -79.24Q378.93 -67.36 378.93 -50.83Q378.93 -38.64 375.00 -28.72Q371.07 -18.80 363.74 -11.88Q356.40 -4.96 345.97 -1.34Q335.54 2.27 322.93 2.27ZM322.93 -24.79Q328.51 -24.79 332.85 -27.58Q337.19 -30.37 339.57 -36.05Q341.94 -41.74 341.94 -50.83Q341.94 -64.67 336.57 -70.76Q331.20 -76.86 322.93 -76.86Q317.36 -76.86 313.02 -74.17Q308.68 -71.49 306.20 -65.81Q303.72 -60.12 303.72 -50.83Q303.72 -37.19 309.09 -30.99Q314.46 -24.79 322.93 -24.79Z" />
         </g>
         {morphFromSmile && (
            <ellipse
               ref={leftEyeRef}
               cx="184"
               cy="-100"
               rx={J_DOT_R}
               ry={J_DOT_R}
               opacity="0"
               style={{ fill: 'var(--logo-dot)' }}
            />
         )}
         <ellipse
            ref={jDotRef}
            cx={J_DOT_X}
            cy={J_DOT_Y}
            rx={J_DOT_R}
            ry={J_DOT_R}
            style={{ fill: 'var(--logo-dot)' }}
         />
         <circle ref={iDotRef} cx="214.48" cy="-135.85" r={J_DOT_R} fill={textColor} />
      </svg>
   );
}
