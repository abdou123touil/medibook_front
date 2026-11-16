import React, { useState, useEffect } from 'react';
import { apiFetch } from "../lib/api";
import { useTranslation } from 'react-i18next';
import { format, addDays } from 'date-fns';
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
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [availableSlots, setAvailableSlots] = useState<{ [key: string]: string[] }>({});
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  const startDate = new Date();
  const weekDays = [...Array(14)].map((_, i) => addDays(startDate, i));

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Fetch available slots on mount
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      try {
        if (!isAuthenticated) {
          toast.error(t('errorPleaseLogin'));
          return;
        }

        const start = format(startDate, 'yyyy-MM-dd');
        const end = format(addDays(startDate, 13), 'yyyy-MM-dd');
        const response = await apiFetch(
          `http://localhost:3000/api/users/doctors/${doctorId}/available-slots?startDate=${start}&endDate=${end}`,
          {
            method: 'GET',
            headers: {
            },
          }
        );

        const data = await response.json();
        

        if (response.ok) {
          setAvailableSlots(data.availableSlots);
          setRequiresConfirmation(data.requiresConfirmation);
        } else {
          toast.error(data.error || t('errorLoadAvailability'));
        }
      } catch (error) {
        
        toast.error(t('errorLoadAvailability'));
      }
    };

    fetchAvailableSlots();
  }, [doctorId, isAuthenticated, t]);

  // Book an appointment
  const bookAppointment = async (time: string) => {
    try {
      if (isSlotInPast(time)) return;
      const patientId = user?.data?.id;
      if (!patientId || !isAuthenticated) {
        toast.error(t('errorPleaseLogin'));
        return;
      }

      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      const response = await apiFetch('http://localhost:3000/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorId,
          date: dateKey,
          time,
        }),
      });

      const data = await response.json();
      

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
      
      toast.error(t('bookingError'));
    }
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateSlots = availableSlots[selectedDateKey] || [];
  const isSlotInPast = (time: string) => {
    const todayKey = format(currentTime, 'yyyy-MM-dd');
    return selectedDateKey < todayKey || (selectedDateKey === todayKey && time <= format(currentTime, 'HH:mm'));
  };

  return (
    <div className="bg-white dark:bg-slate-950 border rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <CalendarIcon className="w-6 h-6 text-indigo-600" />
        {t('bookWithDoctor', { doctor: doctorName })}
      </h2>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {weekDays.map((date) => (
          <button
            key={date.toISOString()}
            onClick={() => setSelectedDate(date)}
            disabled={format(date, 'yyyy-MM-dd') < format(currentTime, 'yyyy-MM-dd')}
            className={clsx(
              "p-2 rounded-xl text-sm font-medium transition-colors",
              format(date, 'yyyy-MM-dd') === selectedDateKey
                ? "bg-indigo-600 text-white"
                : "hover:bg-indigo-50",
              format(date, 'yyyy-MM-dd') < format(currentTime, 'yyyy-MM-dd') && "cursor-not-allowed opacity-40"
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
                disabled={isSlotInPast(time)}
                className={clsx(
                  "p-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  isSlotInPast(time)
                    ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                    : "border border-slate-200 hover:bg-indigo-50"
                )}
              >
                {time}
                <Plus className="w-4 h-4" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">{t('noSlotsForDay')}</p>
        )}
      </div>
      {requiresConfirmation && (
        <p className="mt-4 text-sm text-slate-600">{t('manualConfirmationRequired')}</p>
      )}
    </div>
  );
}
