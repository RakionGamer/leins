// leins-front/src/pages/superAdmin/components/ClientEditModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'components/Modal';
import FormInput from 'components/FormInput';
import FormError from 'components/FormError';
import SpinnerButton from 'components/SpinnerButton';
import { updateClientUser } from '../../../services/clientUsersApi';
import { toast } from 'components/Toaster';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

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
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
         <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
               <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                  <PencilSquareIcon className="w-6 h-6" />
               </div>
               <div>
                  <h2 className="text-xl font-bold text-heading dark:text-white">Editar Cliente</h2>
                  <p className="text-xs text-text-soft">
                     Modifica los datos personales o restablece la contraseña de este cliente.
                  </p>
               </div>
            </div>

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

            <div className="pt-4 border-t border-border-subtle flex justify-end items-center gap-3">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-border-subtle hover:bg-gray-100 dark:hover:bg-white/5 text-text-soft transition cursor-pointer"
               >
                  Cancelar
               </button>
               <SpinnerButton
                  type="submit"
                  loading={saving}
                  className="bg-brand text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-brand-strong transition cursor-pointer active:scale-95"
               >
                  Guardar Cambios
               </SpinnerButton>
            </div>
         </form>
      </Modal>
   );
}
