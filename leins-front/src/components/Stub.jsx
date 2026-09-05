import React from 'react';

export default function Stub({ title = 'En construcción', children }) {
   return (
      <div className="px-4 py-2">
         <h1 className="text-lg font-semibold mb-1">{title}</h1>
         <div className="text-sm opacity-70">
            {children || 'Estamos trabajando para traerte esta sección pronto.'}
         </div>
      </div>
   );
}