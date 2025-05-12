import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, X, Save, Pill } from 'lucide-react';
import toast from 'react-hot-toast';

interface Appointment {
  _id: string;
  patientId?: { firstName: string; lastName: string };
  date: string;
  time: string;
  symptoms: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
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
}

export const AppointmentHistoryModal: React.FC<AppointmentHistoryModalProps> = ({
  isOpen,
  onClose,
  appointments,
}) => {
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

  // Fetch existing appointment details when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchDetails = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            throw new Error('Token d’authentification manquant');
          }

          for (const appointment of appointments) {
            try {
              const response = await fetch(
                `http://localhost:3000/api/appointments/appointment-details/${appointment._id}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (response.ok) {
                const data = await response.json();
                console.log(`Fetched details for appointment ${appointment._id}:`, data);
                setAppointmentDetails((prev) => ({
                  ...prev,
                  [appointment._id]: data.appointmentDetail,
                }));
              } else if (response.status === 404) {
                // Pas de détails pour ce rendez-vous, continuer sans erreur
                console.log(`No details found for appointment ${appointment._id}`);
              } else {
                console.error(`Error fetching details for appointment ${appointment._id}:`, response.status);
              }
            } catch (error) {
              console.error(`Error fetching details for appointment ${appointment._id}:`, error);
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des détails:', error);
          toast.error('Erreur lors de la récupération des détails des rendez-vous.');
        }
      };
      fetchDetails();
    }
  }, [isOpen, appointments]);

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
      setDetails((prev) => ({
        ...prev,
        medicaments: [...prev.medicaments, currentMedicament.trim()],
      }));
      setCurrentMedicament('');
    }
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
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token d’authentification manquant');
      }

      const response = await fetch(
        'http://localhost:3000/api/appointments/appointment-details',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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
        console.error('Error response:', errorText);
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || 'Erreur lors de l’ajout des détails.');
      }

      const data = await response.json();
      console.log('Submitted details:', data);
      setAppointmentDetails((prev) => ({
        ...prev,
        [appointmentId]: data.appointmentDetail,
      }));
      setDetails({ tarif: 0, medicaments: [], cause: '' });
      setSelectedAppointment(null);
      toast.success('Détails ajoutés avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error((error as Error).message || 'Une erreur est survenue.');
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
              Historique des Rendez-vous
            </h2>

            <div className="space-y-4">
              {appointments.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  Aucun rendez-vous trouvé.
                </p>
              ) : (
                appointments.map((appointment) => (
                  <div
                    key={appointment._id}
                    className={`rounded-lg p-4 shadow-sm border ${
                      appointment.status === 'cancelled'
                        ? 'bg-red-50 border-red-200'
                        : appointment.status === 'completed'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Patient:{' '}
                          {appointment.patientId?.firstName || 'Nom non disponible'}{' '}
                          {appointment.patientId?.lastName || 'Prénom non disponible'}
                        </h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(appointment.date), 'PPP', { locale: fr })} à{' '}
                          {appointment.time}
                        </div>
                        <p className="mt-2 text-gray-700 dark:text-gray-300">
                          Symptômes : {appointment.symptoms || 'Non spécifiés'}
                        </p>
                        <p className="mt-1 text-gray-700 dark:text-gray-300">
                          Statut :{' '}
                          <span
                            className={`font-medium ${
                              appointment.status === 'cancelled'
                                ? 'text-red-600'
                                : appointment.status === 'completed'
                                ? 'text-green-600'
                                : 'text-blue-600'
                            }`}
                          >
                            {appointment.status === 'cancelled'
                              ? 'Annulé'
                              : appointment.status === 'completed'
                              ? 'Terminé'
                              : appointment.status === 'accepted'
                              ? 'Accepté'
                              : 'En attente'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {appointment.status === 'completed' && (
                      <div className="mt-4">
                        {appointmentDetails[appointment._id] ? (
                          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                              Détails du rendez-vous
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Tarif : {appointmentDetails[appointment._id].tarif} DT
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Cause : {appointmentDetails[appointment._id].cause}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Médicaments :{' '}
                              {appointmentDetails[appointment._id].medicaments.join(', ')}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <button
                              onClick={() => setSelectedAppointment(appointment)}
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                            >
                              Ajouter les détails
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedAppointment?._id === appointment._id && (
                      <div className="mt-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                          Ajouter les détails
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Tarif (DT)
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
                              Cause
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
                              Médicaments
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={currentMedicament}
                                onChange={(e) => setCurrentMedicament(e.target.value)}
                                placeholder="Ajouter un médicament"
                                className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                              />
                              <button
                                type="button"
                                onClick={handleAddMedicament}
                                className="mt-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                              >
                                <Pill className="w-5 h-5" />
                              </button>
                            </div>
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
                                    Supprimer
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
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmitDetails(appointment._id)}
                              disabled={isSubmitting}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <Save className="w-5 h-5" />
                              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
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