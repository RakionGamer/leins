// leins-front/src/hooks/usePermissions.js
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { getDefaultPermissions } from '../constants/permissions';

export function usePermissions() {
   const { user, isClient, role } = useAuth();
   const { entity } = useEntity();

   const isSuperAdmin = !isClient && (role === 'super_admin' || !role);

   // Resolver el objeto de permisos activo
   const activePermissions = useMemo(() => {
      if (isSuperAdmin) return null; // Acceso total implícito

      // 1. Permisos específicos de la entidad seleccionada
      const entityPerms = entity?.permissions?.granular || entity?.granular_permissions;
      if (entityPerms && typeof entityPerms === 'object') {
         return entityPerms;
      }

      // 2. Permisos globales del usuario cliente
      if (user?.permissions && typeof user?.permissions === 'object') {
         return user.permissions;
      }

      // 3. Fallback a permisos predeterminados seguros
      return getDefaultPermissions();
   }, [isSuperAdmin, entity, user]);

   const can = useMemo(() => {
      return (moduleKey, actionKey) => {
         // Super Administrador siempre tiene permiso total
         if (isSuperAdmin) return true;

         if (!activePermissions) return false;
         const mod = activePermissions[moduleKey];
         if (!mod) return false;

         return Boolean(mod[actionKey]);
      };
   }, [isSuperAdmin, activePermissions]);

   return {
      can,
      isSuperAdmin,
      isClient,
      permissions: activePermissions,
   };
}
