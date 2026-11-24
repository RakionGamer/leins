// leins-front/src/pages/superAdmin/components/ClientEditModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'components/Modal';
import FormInput from 'components/FormInput';
import FormError from 'components/FormError';
import SpinnerButton from 'components/SpinnerButton';
import { updateClientUser } from '../../../services/clientUsersApi';
import { toast } from 'components/Toaster';

export default function ClientEditModal({ isOpen, onClose, client, onSuccess }) {
   const [username, setUsername] = useState('');
   const [email, setEmail] = useState('');
   const [name, setName] = useState('');
   const [lastName, setLastName] = useState('');
   const [password, setPassword] = useState('');
   const [formError, setFormError] = useState(null);
   const [saving, setSaving] = useState(false);

   useEffect(() => {
      if (!client) return;
      setUsername(client.username || '');
      setEmail(client.email || '');
      setName(client.name || '');
      setLastName(client.last_name || '');
      setPassword('');
      setFormError(null);
   }, [client]);

   if (!isOpen || !client) return null;

   const handleSubmit = async (e) => {
      e.preventDefault();
      setFormError(null);

      if (!username.trim() || !email.trim()) {
         setFormError('Usuario y email son obligatorios');
         return;
      }

      setSaving(true);
      try {
         await updateClientUser({
            userId: client.id,
            username: username.trim(),
            email: email.trim(),
            name: name.trim() || null,
            lastName: lastName.trim() || null,
            password: password.trim() ? password.trim() : undefined,
         });

         toast.success('Cliente actualizado correctamente');
         onSuccess?.();
         onClose();
      } catch (err) {
         setFormError(err?.message || 'Error al actualizar cliente');
      } finally {
         setSaving(false);
      }
   };

   return (
      <Modal
         isOpen={isOpen}
         onClose={onClose}
         maxWidth="max-w-xl"
         title={`Editar Cliente — ${client?.username || ''}`}
      >
         <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-[#55607A] -mt-1 pb-3 border-b border-[#E2EAFD]">
               Modifica los datos personales o restablece la contraseña de este cliente.
            </p>

            <FormError message={formError} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <FormInput
                  label="Nombre de usuario *"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
               />
               <FormInput
                  label="Email *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
               />
               <FormInput
                  label="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
               />
               <FormInput
                  label="Apellido"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
               />
               <div className="sm:col-span-2">
                  <FormInput
                     label="Nueva Contraseña (opcional)"
                     type="password"
                     placeholder="Dejar en blanco para mantener la actual"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                  />
               </div>
            </div>

            <div className="pt-4 border-t border-[#E2EAFD] flex justify-end items-center gap-3">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-full border border-[#E2EAFD] text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#F8FAFF] text-xs font-bold transition cursor-pointer"
               >
                  Cancelar
               </button>
               <SpinnerButton
                  type="submit"
                  loading={saving}
                  className="px-6 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
               >
                  Guardar Cambios
               </SpinnerButton>
            </div>
         </form>
      </Modal>
   );
}
