import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, startOfWeek } from 'date-fns';
import { ar, enUS, fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

interface AppointmentSchedulerProps {
  doctorId: string;
  doctorName: string;
}

export function AppointmentScheduler({ doctorId, doctorName }: AppointmentSchedulerProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enUS : fr;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<{ [key: string]: string[] }>({});
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const { user } = useAuthStore();

  const startDate = startOfWeek(new Date(), { locale: dateLocale });
  const weekDays = [...Array(14)].map((_, i) => addDays(startDate, i));

  // Fetch available slots on mount
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error(t('errorPleaseLogin'));
          return;
        }

        const start = format(startDate, 'yyyy-MM-dd');
        const end = format(addDays(startDate, 13), 'yyyy-MM-dd');
        const response = await fetch(
          `http://localhost:3000/api/users/doctors/${doctorId}/available-slots?startDate=${start}&endDate=${end}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();
        console.log('Available slots response:', data);

        if (response.ok) {
          setAvailableSlots(data.availableSlots);
          setRequiresConfirmation(data.requiresConfirmation);
        } else {
          toast.error(data.error || t('errorLoadAvailability'));
        }
      } catch (error) {
        console.error('Error fetching available slots:', error);
        toast.error(t('errorLoadAvailability'));
      }
    };

    fetchAvailableSlots();
  }, [doctorId, t]);

  // Book an appointment
  const bookAppointment = async (time: string) => {
    try {
      const token = localStorage.getItem('token');
      const patientId = user?.data?.id;
      if (!patientId || !token) {
        toast.error(t('errorPleaseLogin'));
        return;
      }

      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch('http://localhost:3000/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId,
          date: dateKey,
          time,
        }),
      });

      const data = await response.json();
      console.log('Book appointment response:', data);

      if (response.ok) {
        // Remove the booked slot from available slots
        setAvailableSlots(prev => ({
          ...prev,
          [dateKey]: prev[dateKey].filter(slot => slot !== time),
        }));
        toast.success(data.message);
      } else {
        toast.error(data.error || t('bookingError'));
      }
    } catch (error) {
      console.error('Erreur lors de la réservation:', error);
      toast.error(t('bookingError'));
    }
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateSlots = availableSlots[selectedDateKey] || [];

  return (
    <div className="bg-white dark:bg-gray-900 border rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <CalendarIcon className="w-6 h-6 text-indigo-600" />
        {t('bookWithDoctor', { doctor: doctorName })}
      </h2>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {weekDays.map((date) => (
          <button
            key={date.toISOString()}
            onClick={() => setSelectedDate(date)}
            className={clsx(
              "p-2 rounded-lg text-sm font-medium transition-colors",
              format(date, 'yyyy-MM-dd') === selectedDateKey
                ? "bg-indigo-600 text-white"
                : "hover:bg-indigo-50"
            )}
          >
            <div className="text-xs mb-1">{format(date, 'EEE', { locale: dateLocale })}</div>
            <div>{format(date, 'd', { locale: dateLocale })}</div>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">
          {t('slotsAvailableOn', { date: format(selectedDate, 'EEEE d MMMM', { locale: dateLocale }) })}
        </h3>
        {selectedDateSlots.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {selectedDateSlots.map((time) => (
              <button
                key={time}
                onClick={() => bookAppointment(time)}
                className={clsx(
                  "p-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  "border border-gray-200 hover:bg-indigo-50"
                )}
              >
                {time}
                <Plus className="w-4 h-4" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">{t('noSlotsForDay')}</p>
        )}
      </div>
      {requiresConfirmation && (
        <p className="mt-4 text-sm text-gray-600">{t('manualConfirmationRequired')}</p>
      )}
    </div>
  );
}
