import React from 'react';

export default function JeitoCurve({
   className = 'curve',
   strokeColor = '#11244E',
   strokeWidth = 145,
   ...props
}) {
   return (
      <svg
         className={className}
         viewBox="0 0 800 400"
         overflow="visible"
         aria-hidden="true"
         {...props}
      >
         <path
            d="M225 195 Q390 490 860 355"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
         />
      </svg>
   );
}