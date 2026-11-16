import React, { useState, useEffect } from 'react';
import { apiFetch } from "../lib/api";
import { X } from 'lucide-react';
import { Calendar } from './Calendar';
import { format } from 'date-fns';
import { ar, enUS, fr } from 'date-fns/locale';
import { Doctor } from '../types';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';

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
const symptomTranslationKeys: Record<string, string> = {
  'Mal de dents': 'symptomToothache', 'Gencives qui saignent': 'symptomBleedingGums', 'Dents sensibles': 'symptomSensitiveTeeth',
  'Douleur à la mâchoire': 'symptomJawPain', 'Mauvaise haleine': 'symptomBadBreath', Fièvre: 'symptomFever', Fatigue: 'symptomFatigue',
  'Maux de tête': 'symptomHeadache', Toux: 'symptomCough', 'Maux de gorge': 'symptomSoreThroat', 'Douleurs musculaires': 'symptomMusclePain',
  Palpitations: 'symptomPalpitations', 'Douleur thoracique': 'symptomChestPain', Essoufflement: 'symptomBreathlessness', Étourdissements: 'symptomDizziness',
  'Fatigue inhabituelle': 'symptomUnusualFatigue', 'Éruption cutanée': 'symptomRash', Démangeaisons: 'symptomItching', Acné: 'symptomAcne',
  'Taches pigmentées': 'symptomPigmentation', 'Peau sèche': 'symptomDrySkin', Vomissements: 'symptomVomiting', Diarrhée: 'symptomDiarrhea',
  'Vision floue': 'symptomBlurredVision', 'Yeux rouges': 'symptomRedEyes', 'Douleur oculaire': 'symptomEyePain', 'Sensibilité à la lumière': 'symptomLightSensitivity',
  'Mouches volantes': 'symptomFloaters', 'Douleur articulaire': 'symptomJointPain', 'Douleur au dos': 'symptomBackPain', Entorse: 'symptomSprain',
  'Raideur musculaire': 'symptomMuscleStiffness', Fracture: 'symptomFracture', 'Mal d’oreille': 'symptomEarache', 'Nez bouché': 'symptomBlockedNose',
  'Perte d’audition': 'symptomHearingLoss', Vertiges: 'symptomVertigo',
};

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor;
}

export function BookingModal({ isOpen, onClose, doctor }: BookingModalProps) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const dateLocale = i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enUS : fr;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [isTeleconsultation, setIsTeleconsultation] = useState(false);
  const [liveAvailability, setLiveAvailability] = useState<Record<string, string[]>>({});
  const [blockedPeriods, setBlockedPeriods] = useState<{ startDate: string; endDate: string }[]>([]);
  const [patientBusySlots, setPatientBusySlots] = useState<Record<string, string[]>>({});
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  const resetForm = () => {
    setSelectedDate(new Date());
    setSelectedTime(null);
    setSelectedSymptoms([]);
    setIsTeleconsultation(false);
    setWaitlistJoined(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Refresh booked appointments and free slots while the modal is open.
  useEffect(() => {
    if (!isOpen || !doctor?._id) return;

    let isActive = true;
    const refreshBookingData = async () => {
      try {
        const today = new Date();
        const startDate = format(today, 'yyyy-MM-dd');
        const end = new Date(today);
        end.setDate(end.getDate() + 14);
        const endDate = format(end, 'yyyy-MM-dd');

        const slotsResponse = await apiFetch(
          `http://localhost:3000/api/users/doctors/${doctor._id}/available-slots?startDate=${startDate}&endDate=${endDate}`
        );
        if (!slotsResponse.ok) {
          throw new Error(t('errorFetchAvailability'));
        }

        const slotsData = await slotsResponse.json();
        if (!isActive) return;
        setLiveAvailability(slotsData.availableSlots || {});
        setBlockedPeriods(slotsData.blockedPeriods || []);

        if (isAuthenticated) {
          const appointmentsResponse = await apiFetch('http://localhost:3000/api/appointments');
          if (appointmentsResponse.ok) {
            const appointmentsData = await appointmentsResponse.json();
            const busySlots: Record<string, string[]> = {};
            for (const appointment of appointmentsData.appointments || []) {
              if (!['pending', 'accepted'].includes(appointment.status)) continue;
              const date = new Date(appointment.date);
              if (Number.isNaN(date.getTime())) continue;
              const dateKey = format(date, 'yyyy-MM-dd');
              busySlots[dateKey] = [...(busySlots[dateKey] || []), appointment.time];
            }
            if (isActive) setPatientBusySlots(busySlots);
          }
        } else {
          setPatientBusySlots({});
        }
      } catch (error) {
        
      }
    };

    refreshBookingData();
    const intervalId = window.setInterval(refreshBookingData, 5000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [isOpen, doctor?._id, isAuthenticated]);

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

    const bookingDateKey = format(selectedDate, 'yyyy-MM-dd');
    if ((patientBusySlots[bookingDateKey] || []).includes(selectedTime || '')) {
      toast.error(t('appointmentTimeConflict'));
      setSelectedTime(null);
      return;
    }
    if (blockedPeriods.some((period) => bookingDateKey >= period.startDate && bookingDateKey <= period.endDate)) {
      toast.error(t('doctorAbsentDay'));
      setSelectedTime(null);
      return;
    }

    const patientId = useAuthStore.getState().user?.data?.id;

    if (!patientId) {
      toast.error(t('userNotRecognized'));
      return;
    }

    if (!selectedTime || selectedSymptoms.length === 0) {
      toast.error(t('selectTimeAndSymptom'));
      return;
    }

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const symptoms = selectedSymptoms.join(', ');

    // The API slot list is authoritative and already excludes reserved times.
    if (!(liveAvailability[formattedDate] || []).includes(selectedTime)) {
      toast.error(t('slotAlreadyUnavailable'));
      return;
    }

    try {
      const response = await apiFetch('http://localhost:3000/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(data.error || data.message || t('bookingError'));
      }

      
      toast.success(data.message || t('appointmentBooked'));
      handleClose();
    } catch (error) {
      
      toast.error(error instanceof Error ? error.message : t('errorTryAgain'));
    }
  };

  const handleJoinWaitlist = async () => {
    if (joiningWaitlist || waitlistJoined) return;
    if (!isAuthenticated) {
      toast.error(t('loginForWaitlist'));
      return;
    }
    setJoiningWaitlist(true);
    try {
      const response = await apiFetch('http://localhost:3000/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: doctor._id, date: format(selectedDate, 'yyyy-MM-dd'), symptoms: selectedSymptoms.join(', ') }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('waitlistJoinError'));
      setWaitlistJoined(true);
      toast.success(data.message || t('waitlistJoined'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('waitlistJoinError'));
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleBookAppointment();
  };

  if (!isOpen) return null;

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const cleanedAvailability: { [date: string]: string[] } = {};
  for (const [date, times] of Object.entries(liveAvailability)) {
    if (date !== '$*' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      cleanedAvailability[date] = times;
    }
  }
  const availableSlots = cleanedAvailability[formattedDate] || [];
  const selectedDateIsBlocked = blockedPeriods.some((period) => formattedDate >= period.startDate && formattedDate <= period.endDate);
  const hasScheduledSlots = Object.prototype.hasOwnProperty.call(cleanedAvailability, formattedDate);
  const symptoms = symptomsBySpeciality[doctor.speciality] || [];

  const isSlotBooked = (time: string) => {
    const isBooked = !availableSlots.includes(time) || (patientBusySlots[formattedDate] || []).includes(time);

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
  const hasFreeSlot = availableSlots.some((time) => !isSlotBooked(time));
  const nearestOpenSlots = Object.entries(cleanedAvailability)
    .flatMap(([date, times]) => times
      .filter((time) => {
        const isBlocked = blockedPeriods.some((period) => date >= period.startDate && date <= period.endDate);
        const appointmentDateTime = new Date(`${date}T${time}:00`);
        return !isBlocked && appointmentDateTime > new Date();
      })
      .map((time) => ({ date, time, dateTime: new Date(`${date}T${time}:00`) }))
    )
    .sort((first, second) => first.dateTime.getTime() - second.dateTime.getTime())
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-500 bg-opacity-75 flex justify-center items-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="bg-white dark:bg-slate-950 rounded-xl shadow-xl p-6 w-full max-w-2xl relative"
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          aria-label={t('close')}
        >
          <X className="w-6 h-6" />
        </button>

        <h2 id="modal-title" className="text-2xl font-bold mb-6">
          {t('bookAppointment')} {doctor.lastName}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6 hover:text-slate-600">
          <Calendar
            selectedDate={selectedDate}
            availableSlots={availableSlots}
            blockedPeriods={blockedPeriods}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setSelectedTime(null);
            }}
            onTimeSelect={setSelectedTime}
            selectedTime={selectedTime}
            isSlotBooked={isSlotBooked}
            isPatientBusySlot={(time) => (patientBusySlots[formattedDate] || []).includes(time)}
          />

          {(selectedDateIsBlocked || !hasFreeSlot) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                {t('nearestSuggestions')}
              </h3>
              <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                {selectedDateIsBlocked
                  ? t('blockedDaySuggestion')
                  : t('noFreeSlotSuggestion')}
              </p>
              {nearestOpenSlots.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {nearestOpenSlots.map((slot) => (
                    <button
                      key={`${slot.date}-${slot.time}`}
                      type="button"
                      onClick={() => {
                        setSelectedDate(new Date(`${slot.date}T12:00:00`));
                        setSelectedTime(slot.time);
                      }}
                      className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-amber-700 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-slate-800"
                    >
                      {format(slot.dateTime, 'EEE d MMM', { locale: dateLocale })} · {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-amber-900 dark:text-amber-200">
                  {t('noOtherSlots')}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
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
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-200 rounded"
                    />
                    <span className="text-sm text-slate-700">{t(symptomTranslationKeys[symptom] || symptom)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {t('noSymptoms')}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isTeleconsultation}
                onChange={(e) => setIsTeleconsultation(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-200 rounded"
              />
              <span>{t('videoConsultation')}</span>
            </label>
          </div>

          {hasScheduledSlots && !hasFreeSlot && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
              <span>{t('noFreeSlotWaitlist')}</span>
              <button
                type="button"
                onClick={handleJoinWaitlist}
                disabled={joiningWaitlist || waitlistJoined}
                className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joiningWaitlist ? t('joining') : waitlistJoined ? t('joined') : t('waitlist')}
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!selectedTime || selectedSymptoms.length === 0 || selectedDateIsBlocked}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('confirmAppointment')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
