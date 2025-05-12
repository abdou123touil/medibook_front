import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Calendar } from './Calendar';
import { format } from 'date-fns';
import { Doctor, Appointment } from '../types';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

// Liste des symptômes par spécialité
const symptomsBySpeciality: Record<string, string[]> = {
  Dentiste: [
    'Mal de dents',
    'Gencives qui saignent',
    'Dents sensibles',
    'Douleur à la mâchoire',
    'Mauvaise haleine',
  ],
  Generaliste: [
    'Fièvre',
    'Fatigue',
    'Maux de tête',
    'Toux',
    'Maux de gorge',
    'Douleurs musculaires',
  ],
  cardiologue: [
    'Palpitations',
    'Douleur thoracique',
    'Essoufflement',
    'Étourdissements',
    'Fatigue inhabituelle',
  ],
  Dermatologue: [
    'Éruption cutanée',
    'Démangeaisons',
    'Acné',
    'Taches pigmentées',
    'Peau sèche',
  ],
  Pédiatre: [
    'Fièvre',
    'Toux',
    'Éruption cutanée',
    'Vomissements',
    'Diarrhée',
  ],
  Ophtalmologue: [
    'Vision floue',
    'Yeux rouges',
    'Douleur oculaire',
    'Sensibilité à la lumière',
    'Mouches volantes',
  ],
  Orthopédiste: [
    'Douleur articulaire',
    'Douleur au dos',
    'Entorse',
    'Raideur musculaire',
    'Fracture',
  ],
  ORL: [
    'Mal d’oreille',
    'Nez bouché',
    'Maux de gorge',
    'Perte d’audition',
    'Vertiges',
  ],
};

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor;
}

export function BookingModal({ isOpen, onClose, doctor }: BookingModalProps) {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [isTeleconsultation, setIsTeleconsultation] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const resetForm = () => {
    setSelectedDate(new Date());
    setSelectedTime(null);
    setSelectedSymptoms([]);
    setIsTeleconsultation(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Fetch doctor's appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        console.log('Fetching appointments for doctor:', doctor);
        console.log('Doctor ID:', doctor._id);
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:3000/api/appointments/doctor/${doctor._id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des rendez-vous.');
        }

        const data = await response.json();
        if (!Array.isArray(data.appointments)) {
          console.error('Réponse inattendue:', data);
          throw new Error('Les rendez-vous reçus ne sont pas dans un format valide.');
        }
        setAppointments(data.appointments);
      } catch (error) {
        console.error('Erreur:', error);
        toast.error('Impossible de vérifier les rendez-vous existants.');
        setAppointments([]);
      }
    };

    if (isOpen && doctor) {
      fetchAppointments();
    }
  }, [isOpen, doctor]);

  // Handle symptom checkbox changes
  const handleSymptomChange = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleBookAppointment = async () => {
    if (!doctor) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const patientId = user?.id || user?.data?.id;

    if (!patientId) {
      toast.error('Utilisateur non reconnu. Veuillez vous reconnecter.');
      return;
    }

    if (!selectedTime || selectedSymptoms.length === 0) {
      toast.error('Veuillez sélectionner une heure et au moins un symptôme.');
      return;
    }

    const formattedDate = selectedDate.toISOString().split('T')[0];
    const symptoms = selectedSymptoms.join(', ');

    // Check if the slot is already booked
    const isBooked = Array.isArray(appointments) && appointments.some(
      apt =>
        format(new Date(apt.date), 'yyyy-MM-dd') === formattedDate &&
        apt.time === selectedTime &&
        ['pending', 'accepted', 'completed'].includes(apt.status)
    );

    if (isBooked) {
      toast.error('Ce créneau est déjà réservé ou indisponible. Veuillez en choisir un autre.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: doctor._id,
          patientId,
          date: formattedDate,
          time: selectedTime,
          symptoms,
          isTeleconsultation,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la prise de rendez-vous.');
      }

      console.log('Rendez-vous créé:', data);
      toast.success('Rendez-vous confirmé avec succès !');
      handleClose();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(error.message || 'Une erreur est survenue. Veuillez réessayer.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleBookAppointment();
  };

  if (!isOpen) return null;

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const cleanedAvailability: { [date: string]: string[] } = {};
  for (const [date, times] of Object.entries(doctor.availability || {})) {
    if (date !== '$*' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      cleanedAvailability[date] = times;
    }
  }
  const availableSlots = cleanedAvailability[formattedDate] || [];
  const symptoms = symptomsBySpeciality[doctor.speciality] || [];

  const isSlotBooked = (time: string) => {
    const isBooked = Array.isArray(appointments) && appointments.some(
      apt =>
        format(new Date(apt.date), 'yyyy-MM-dd') === formattedDate &&
        apt.time === time &&
        ['pending', 'accepted', 'completed'].includes(apt.status)
    );

    const now = new Date();
    const isToday = format(now, 'yyyy-MM-dd') === formattedDate;
    if (isToday) {
      const [hours, minutes] = time.split(':').map(Number);
      const slotDateTime = new Date(selectedDate);
      slotDateTime.setHours(hours, minutes, 0, 0);
      if (slotDateTime < now) {
        return true;
      }
    }

    return isBooked;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-500 bg-opacity-75 flex justify-center items-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-2xl relative"
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Fermer"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 id="modal-title" className="text-2xl font-bold mb-6">
          {t('bookAppointment')} {doctor.lastName}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6 hover:text-gray-600">
          <Calendar
            selectedDate={selectedDate}
            availableSlots={availableSlots}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setSelectedTime(null);
            }}
            onTimeSelect={setSelectedTime}
            selectedTime={selectedTime}
            isSlotBooked={isSlotBooked}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('symptoms')}
            </label>
            {symptoms.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {symptoms.map((symptom) => (
                  <label key={symptom} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedSymptoms.includes(symptom)}
                      onChange={() => handleSymptomChange(symptom)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{symptom}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {t('noSymptoms')}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isTeleconsultation}
                onChange={(e) => setIsTeleconsultation(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span>{t('videoConsultation')}</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!selectedTime || selectedSymptoms.length === 0}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('confirmAppointment')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}