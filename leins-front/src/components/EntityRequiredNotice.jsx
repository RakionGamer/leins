import { useEntityRequired } from '../hooks/useEntityRequired';
import SplashScreen from './SplashScreen';

export default function EntityRequiredNotice() {
   const { loading, hasEntities, ready } = useEntityRequired();

   // Mientras cargan las entidades o se autoselecciona la primera, no mostrar aviso de error/advertencia
   if (loading || (hasEntities && !ready)) {
      return <SplashScreen fullScreen={false} label="Cargando..." />;
   }

   return (
      <div className="rounded-2xl border border-[#E2EAFD] dark:border-[#182B52] bg-white dark:bg-[#0C1A38] p-6 shadow-xs">
         <h1 className="text-lg font-black font-nunito text-[#0A1A3F] dark:text-white">
            Selecciona una entidad para continuar
         </h1>
         <p className="mt-1 text-sm text-[#55607A] dark:text-[#8DA2CC]">
            Este módulo requiere una entidad activa. Usa el selector de empresa en la parte superior.
         </p>
      </div>
   );
}
