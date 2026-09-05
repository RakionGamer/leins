import React, { useState, useEffect } from 'react';
import FormInput from 'components/FormInput';
import FormError from 'components/FormError';
import SpinnerButton from 'components/SpinnerButton';
import { updateManualIncome } from '../../../services/siiDocumentsApi';
import { toast } from 'components/Toaster';
import { SII_DOCUMENT_FILTERS } from '../../../utils/siiConstants';

// importamos react-hook-form y zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ==========================================
// iconos svg locales
// ==========================================
const IconDocument = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg> );
const IconBuilding = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" /></svg> );
const IconCalendar = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg> );
const IconMoney = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> );
const IconUser = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg> );
const IconId = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" /></svg> );
const IconChevronDown = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 opacity-70"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg> );
const IconHashtag = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" /></svg> );

// ==========================================
// utilidades (formateo y validacion)
// ==========================================
const formatRut = (rut) => {
   if (!rut) return '';
   let cleanRut = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
   if (cleanRut.length === 0) return '';
   const dv = cleanRut.slice(-1);
   let body = cleanRut.slice(0, -1);
   body = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
   return body ? `${body}-${dv}` : dv;
};

const validateRut = (rut) => {
   if (!rut) return true; 
   const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
   if (cleanRut.length < 2) return false;
   const dv = cleanRut.slice(-1);
   let body = parseInt(cleanRut.slice(0, -1), 10);
   let sum = 0, multiplier = 2;
   while (body > 0) { sum += (body % 10) * multiplier; body = Math.floor(body / 10); multiplier = multiplier < 7 ? multiplier + 1 : 2; }
   const expectedDv = 11 - (sum % 11);
   const calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : String(expectedDv);
   return dv === calculatedDv;
};

// ==========================================
// esquema de validacion para edicion de ingresos
// ==========================================
const incomeEditSchema = z.object({
   doc_type_code: z.string().min(1, 'Seleccione un tipo de boleta'),
   folio: z.string().optional(),
   issue_date: z.string().min(1, 'La fecha es obligatoria'),
   total_amount: z.coerce.number({ invalid_type_error: 'Monto invalido' }).min(0.01, 'El monto debe ser mayor a 0'),
   counterparty_name: z.string().optional(),
   counterparty_rut: z.string().optional().refine((val) => validateRut(val), {
      message: 'El rut ingresado no es valido',
   }),
});

const EditIncomeForm = ({ document, onSuccess, onCancel }) => {
   const [globalError, setGlobalError] = useState(null);
   const [isSubmitting, setIsSubmitting] = useState(false);

   // inicializamos react-hook-form
   const {
      register,
      handleSubmit,
      setValue,
      reset,
      formState: { errors },
   } = useForm({
      resolver: zodResolver(incomeEditSchema),
      defaultValues: {
         doc_type_code: '',
         folio: '',
         issue_date: '',
         total_amount: '',
         counterparty_name: '',
         counterparty_rut: '',
      }
   });

   // escuchamos cambios en el prop 'document' para precargar los datos
   useEffect(() => {
      if (document) {
         const safeDate = document.date ? document.date.split('T')[0] : '';
         reset({
            doc_type_code: document.doc_type_code ? String(document.doc_type_code) : '',
            issue_date: safeDate,
            total_amount: document.total || '',
            folio: document.folio || '',
            counterparty_rut: formatRut(document.counterparty_rut || ''),
            counterparty_name: document.counterparty_name || '',
         });
      }
   }, [document, reset]);

   const scrollToError = () => {
      window.document.getElementById('scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' });
   };

   // funcion de envio validada
   const onSubmit = async (data) => {
      setIsSubmitting(true);
      setGlobalError(null);

      try {
         const payload = {
            operation_type: 'INCOME',
            issue_date: data.issue_date,
            total_amount: data.total_amount,
            doc_type_code: data.doc_type_code ? Number(data.doc_type_code) : null,
            folio: data.folio || null,
            counterparty_rut: data.counterparty_rut || null,
            counterparty_name: data.counterparty_name || null,
         };

         // usamos updateManualIncome en lugar de create
         await updateManualIncome(document.id, payload);
         toast.success('ingreso actualizado con exito');
         if (onSuccess) onSuccess();

      } catch (err) {
         setGlobalError(err.message || 'ocurrio un error al actualizar el ingreso');
         scrollToError();
      } finally {
         setIsSubmitting(false);
      }
   };

   const selectCtrl = 'w-full h-11 pl-10 pr-10 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition appearance-none';
   const disabledCtrl = 'w-full h-11 pl-10 pr-4 text-sm rounded-2xl border border-border-subtle bg-surface-1 text-text-soft cursor-not-allowed';

   return (
      <div className="relative p-1">
         {isSubmitting && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg-content/60 backdrop-blur-sm rounded-2xl">
               <div className="w-12 h-12 border-4 border-brand/30 border-t-brand rounded-full animate-spin"></div>
               <p className="mt-4 text-sm font-semibold text-brand">guardando cambios...</p>
            </div>
         )}

         <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[75vh]">
            
            <div className="shrink-0 flex items-center gap-4 pb-3 mb-4 border-b border-border-subtle">
               <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/10 text-brand shadow-sm shrink-0">
                  <IconDocument />
               </div>
               <div className="flex-1">
                  <div className="flex items-center gap-2">
                     <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Editar Ingreso
                     </h3>
                     <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:border-green-800">
                        Registro Manual
                     </span>
                  </div>
                  <p className="text-sm text-text-soft mt-0.5">
                     modifique los datos del documento de ingreso.
                  </p>
               </div>
            </div>

            <div id="scroll-container" className="flex-1 overflow-y-auto pr-2 pb-2 space-y-5 custom-scrollbar">
               {globalError && <FormError message={globalError} />}

               <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-text-soft uppercase tracking-wider">
                     Datos del Ingreso
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     
                     <div className="space-y-1.5 relative md:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-text-main">
                           <span className="text-text-soft opacity-80"><IconBuilding /></span>
                           Entidad Asignada (No editable)
                        </label>
                        <div className="relative">
                           <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-soft"><IconBuilding /></span>
                           <input type="text" disabled value={`ID: ${document?.entity_id || 'N/A'}`} className={disabledCtrl} />
                        </div>
                     </div>

                     <div className="space-y-1.5 relative md:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-text-main">
                           <span className="text-brand opacity-80"><IconDocument /></span>
                           Tipo de Boleta <span className="text-danger">*</span>
                        </label>
                        <div className="relative">
                           <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-soft"><IconDocument /></span>
                           <select 
                              disabled={isSubmitting} 
                              className={`${selectCtrl} ${errors.doc_type_code ? 'border-danger' : ''}`}
                              {...register('doc_type_code')}
                           >
                              <option value="">Seleccione un tipo...</option>
                              {SII_DOCUMENT_FILTERS.manualIncome.map((option) => (
                                 <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                           </select>
                           <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-soft pointer-events-none"><IconChevronDown /></span>
                        </div>
                        {errors.doc_type_code && <p className="text-danger text-xs mt-1">{errors.doc_type_code.message}</p>}
                     </div>

                     <div>
                        <FormInput 
                           label="Número de folio (Opc)" 
                           type="text" 
                           placeholder="Ej: 10542" 
                           disabled={isSubmitting} 
                           icon={<IconHashtag />} 
                           {...register('folio')}
                        />
                     </div>

                     <div>
                        <FormInput 
                           label="Fecha del ingreso *" 
                           type="date" 
                           disabled={isSubmitting} 
                           icon={<IconCalendar />} 
                           {...register('issue_date')}
                        />
                        {errors.issue_date && <p className="text-danger text-xs mt-1 pl-1">{errors.issue_date.message}</p>}
                     </div>
                     
                     <div>
                        <FormInput 
                           label="Monto total *" 
                           type="number" 
                           step="0.01" 
                           min="0.01"
                           placeholder="0.00" 
                           disabled={isSubmitting} 
                           icon={<IconMoney />} 
                           {...register('total_amount')}
                        />
                        {errors.total_amount && <p className="text-danger text-xs mt-1 pl-1">{errors.total_amount.message}</p>}
                     </div>
                  </div>
               </div>

               <div className="space-y-4 pt-1">
                  <h4 className="text-sm font-semibold text-text-soft uppercase tracking-wider">
                     Información de la Contraparte
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormInput 
                        label="Nombre o Razón Social" 
                        type="text" 
                        placeholder="Ej: Juan Pérez" 
                        disabled={isSubmitting} 
                        icon={<IconUser />} 
                        {...register('counterparty_name')}
                     />

                     <div>
                        <FormInput 
                           label="RUT o Identificador" 
                           type="text" 
                           placeholder="Ej: 12.345.678-9" 
                           disabled={isSubmitting} 
                           icon={<IconId />} 
                           {...register('counterparty_rut', {
                              onChange: (e) => {
                                 setValue('counterparty_rut', formatRut(e.target.value));
                              }
                           })}
                        />
                        {errors.counterparty_rut && <p className="text-danger text-xs mt-1 pl-1">{errors.counterparty_rut.message}</p>}
                     </div>
                  </div>
               </div>
            </div>

            <div className="shrink-0 flex justify-end gap-3.5 mt-4 pt-4 border-t border-border-subtle">
               <button
                  type="button"
                  onClick={onCancel}
                  className="h-11 px-6 text-sm font-semibold text-text-main bg-surface-1 rounded-2xl border border-border-subtle hover:bg-surface-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-subtle"
                  disabled={isSubmitting}
               >
                  Cancelar
               </button>
               
               <SpinnerButton
                  type="submit"
                  loading={isSubmitting}
                  className="h-11 px-6 text-sm font-semibold text-white bg-brand rounded-2xl hover:bg-brand-hover transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
               >
                  Guardar Cambios
               </SpinnerButton>
            </div>
         </form>
      </div>
   );
};

export default EditIncomeForm;
