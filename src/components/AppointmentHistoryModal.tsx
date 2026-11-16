import React, { useState, useEffect } from 'react';
import { apiFetch } from "../lib/api";
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, X, Save, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface Appointment {
  _id: string;
  patientId?: { firstName: string; lastName: string };
  date: string;
  time: string;
  symptoms: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  cancellationReason?: string | null;
}

interface AppointmentDetails {
  tarif: number;
  medicaments: string[];
  cause: string;
}

interface AppointmentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  title?: string;
  onDetailsSaved?: (appointmentId: string) => void;
}

export const AppointmentHistoryModal: React.FC<AppointmentHistoryModalProps> = ({
  isOpen,
  onClose,
  appointments,
  title,
  onDetailsSaved,
}) => {
  const { t } = useTranslation();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [details, setDetails] = useState<AppointmentDetails>({
    tarif: 0,
    medicaments: [],
    cause: '',
  });
  const [currentMedicament, setCurrentMedicament] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<{
    [key: string]: AppointmentDetails;
  }>({});
  const [isLoadingAppointmentDetails, setIsLoadingAppointmentDetails] = useState(false);
  const [medicationSuggestions, setMedicationSuggestions] = useState<string[]>([]);
  const [isSearchingMedications, setIsSearchingMedications] = useState(false);

  const orderedAppointments = [...appointments].sort((a, b) => {
    const aIncomplete = a.status === 'completed' && !appointmentDetails[a._id];
    const bIncomplete = b.status === 'completed' && !appointmentDetails[b._id];
    if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Fetch existing appointment details when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetchDetails = async () => {
      setIsLoadingAppointmentDetails(true);
      const entries = await Promise.all(appointments.map(async (appointment) => {
        try {
          const response = await apiFetch(
            `http://localhost:3000/api/appointments/appointment-details/${appointment._id}`
          );
          if (!response.ok) return null;
          const data = await response.json();
          return [appointment._id, data.appointmentDetail] as const;
        } catch {
          return null;
        }
      }));
      if (!cancelled) {
        setAppointmentDetails((previous) => {
          const next = { ...previous };
          appointments.forEach(({ _id }) => { delete next[_id]; });
          entries.forEach((entry) => {
            if (entry) next[entry[0]] = entry[1];
          });
          return next;
        });
        setIsLoadingAppointmentDetails(false);
      }
    };
    fetchDetails();
    return () => { cancelled = true; };
  }, [isOpen, appointments]);

  useEffect(() => {
    const query = currentMedicament.trim();
    if (!isOpen || query.length < 2) {
      setMedicationSuggestions([]);
      setIsSearchingMedications(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearchingMedications(true);
      try {
        const response = await apiFetch(
          `http://localhost:3000/api/medications/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const data = response.ok ? await response.json() : { results: [] };
        setMedicationSuggestions(Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setMedicationSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setIsSearchingMedications(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [currentMedicament, isOpen]);

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setDetails((prev) => ({
      ...prev,
      [name]: name === 'tarif' ? Number(value) : value,
    }));
  };

  // Handle adding a medicament
  const handleAddMedicament = () => {
    if (currentMedicament.trim()) {
      const medication = currentMedicament.trim();
      setDetails((prev) => ({
        ...prev,
        medicaments: prev.medicaments.some((item) => item.toLocaleLowerCase() === medication.toLocaleLowerCase())
          ? prev.medicaments
          : [...prev.medicaments, medication],
      }));
      setCurrentMedicament('');
      setMedicationSuggestions([]);
    }
  };

  const selectMedication = (medication: string) => {
    setDetails((prev) => ({
      ...prev,
      medicaments: prev.medicaments.some((item) => item.toLocaleLowerCase() === medication.toLocaleLowerCase())
        ? prev.medicaments
        : [...prev.medicaments, medication],
    }));
    setCurrentMedicament('');
    setMedicationSuggestions([]);
  };

  // Handle removing a medicament
  const handleRemoveMedicament = (index: number) => {
    setDetails((prev) => ({
      ...prev,
      medicaments: prev.medicaments.filter((_, i) => i !== index),
    }));
  };

  // Handle form submission
  const handleSubmitDetails = async (appointmentId: string) => {
    if (!details.tarif || details.medicaments.length === 0 || !details.cause) {
      toast.error(t('fillAllFields'));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiFetch(
        'http://localhost:3000/api/appointments/appointment-details',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointmentId,
            tarif: details.tarif,
            medicaments: details.medicaments,
            cause: details.cause,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || t('appointmentDetailsSaveError'));
      }

      const data = await response.json();
      
      setAppointmentDetails((prev) => ({
        ...prev,
        [appointmentId]: data.appointmentDetail,
      }));
      setDetails({ tarif: 0, medicaments: [], cause: '' });
      setSelectedAppointment(null);
      onDetailsSaved?.(appointmentId);
      toast.success(t('appointmentDetailsSaved'));
    } catch (error) {
      
      toast.error((error as Error).message || t('errorTryAgain'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 flex justify-center items-center z-50"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-lg"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-600" />
              {title || t('appointmentHistory')}
            </h2>

            <div className="space-y-4">
              {appointments.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ">
                  {t('noAppointmentsFound')}
                </p>
              ) : isLoadingAppointmentDetails ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">{t('loading')}</p>
              ) : (
                orderedAppointments.map((appointment) => (
                  <div
                    key={appointment._id}
                    className={`rounded-lg p-4 shadow-sm border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${
                      appointment.status === 'cancelled'
                        ? 'bg-red-50 border-red-200'
                        : appointment.status === 'completed'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex justify-between items-start dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {t('patient')}: {appointment.patientId?.firstName || t('nameNotAvailable')}{' '}
                          {appointment.patientId?.lastName || t('nameNotAvailable')}
                        </h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(appointment.date), 'PPP', { locale: fr })} {t('at')}{' '}
                          {appointment.time}
                        </div>
                        <p className="mt-2 text-gray-700 dark:text-gray-300">
                          {t('symptoms')}: {appointment.symptoms || t('notSpecified')}
                        </p>
                        <p className="mt-1 text-gray-700 dark:text-gray-300">
                          {t('status')}: {' '}
                          <span
                            className={`font-medium ${
                              appointment.status === 'cancelled'
                                ? 'text-red-600'
                                : appointment.status === 'completed'
                                ? 'text-green-600'
                                : 'text-blue-600'
                            }`}
                          >
                            {t(appointment.status)}
                          </span>
                        </p>
                        {appointment.status === 'cancelled' && appointment.cancellationReason && (
                          <p className="mt-2 rounded-md bg-red-100 p-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                            {t('reason')}: {appointment.cancellationReason}
                          </p>
                        )}
                      </div>
                    </div>

                    {appointment.status === 'completed' && (
                      <div className="mt-4">
                        {appointmentDetails[appointment._id] ? (
                          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                              {t('appointmentDetails')}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {t('price')}: {appointmentDetails[appointment._id].tarif} DT
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {t('cause')}: {appointmentDetails[appointment._id].cause}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {t('medications')}: {' '}
                              {appointmentDetails[appointment._id].medicaments.join(', ')}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <button
                              onClick={() => setSelectedAppointment(appointment)}
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                            >
                              {t('addDetails')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedAppointment?._id === appointment._id && (
                      <div className="mt-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            {t('addDetails')}
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              {t('priceDT')}
                            </label>
                            <input
                              type="number"
                              name="tarif"
                              value={details.tarif}
                              onChange={handleInputChange}
                              min="40"
                              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              {t('cause')}
                            </label>
                            <textarea
                              name="cause"
                              value={details.cause}
                              onChange={handleInputChange}
                              rows={3}
                              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              {t('medications')}
                            </label>
                            <div className="relative flex gap-2">
                              <input
                                type="text"
                                value={currentMedicament}
                                onChange={(e) => setCurrentMedicament(e.target.value)}
                                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddMedicament(); } }}
                                placeholder={t('searchMedication')}
                                autoComplete="off"
                                className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                              />
                              <button
                                type="button"
                                onClick={handleAddMedicament}
                                className="mt-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                              >
                                <Pill className="w-5 h-5" />
                              </button>
                              {(isSearchingMedications || medicationSuggestions.length > 0) && (
                                <div className="absolute left-0 right-14 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                                  {isSearchingMedications && <p className="px-3 py-2 text-sm text-gray-500">{t('searchingMedications')}</p>}
                                  {medicationSuggestions.map((suggestion) => (
                                    <button key={suggestion} type="button" onClick={() => selectMedication(suggestion)} className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-indigo-50 dark:text-gray-100 dark:hover:bg-gray-700">
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('medicationCatalogDisclaimer')}</p>
                            <ul className="mt-2 space-y-1">
                              {details.medicaments.map((med, index) => (
                                <li
                                  key={index}
                                  className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300"
                                >
                                  <span>{med}</span>
                                  <button
                                    onClick={() => handleRemoveMedicament(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    {t('delete')}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex justify-end space-x-4">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAppointment(null);
                                setDetails({ tarif: 0, medicaments: [], cause: '' });
                              }}
                              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                              {t('cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmitDetails(appointment._id)}
                              disabled={isSubmitting}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <Save className="w-5 h-5" />
                              {isSubmitting ? t('saving') : t('save')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
