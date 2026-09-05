export default function EntityRequiredNotice() {
   return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
         <h1 className="text-lg font-semibold">Selecciona una entidad para continuar</h1>
         <p className="mt-1 text-sm">
            Este modulo requiere una entidad activa. Usa el selector de empresa en la parte superior.
         </p>
      </div>
   );
}
