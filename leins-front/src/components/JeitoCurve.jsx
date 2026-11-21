import React from 'react';

export default function JeitoCurve({
   className = 'curve',
   strokeColor = '#13285C',
   strokeWidth = 70,
   ...props
}) {
   return (
      <svg
         className={className}
         viewBox="0 0 1000 500"
         aria-hidden="true"
         {...props}
      >
         <path
            d="M80 60 Q500 640 920 60"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
         />
      </svg>
   );
}
