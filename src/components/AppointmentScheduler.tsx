import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

interface AppointmentSchedulerProps {
  doctorId: string;
  doctorName: string;
}

export function AppointmentScheduler({ doctorId, doctorName }: AppointmentSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<{ [key: string]: string[] }>({});
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const { user } = useAuthStore();

  const startDate = startOfWeek(new Date(), { locale: fr });
  const weekDays = [...Array(14)].map((_, i) => addDays(startDate, i));

  // Fetch available slots on mount
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Veuillez vous connecter pour réserver un rendez-vous.');
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
          toast.error(data.error || 'Impossible de charger les créneaux disponibles.');
        }
      } catch (error) {
        console.error('Error fetching available slots:', error);
        toast.error('Erreur lors du chargement des créneaux disponibles.');
      }
    };

    fetchAvailableSlots();
  }, [doctorId]);

  // Book an appointment
  const bookAppointment = async (time: string) => {
    try {
      const token = localStorage.getItem('token');
      const patientId = user?.data?.id;
      if (!patientId || !token) {
        toast.error('Veuillez vous connecter pour réserver un rendez-vous.');
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
        toast.error(data.error || 'Erreur lors de la réservation.');
      }
    } catch (error) {
      console.error('Erreur lors de la réservation:', error);
      toast.error('Erreur serveur lors de la réservation.');
    }
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateSlots = availableSlots[selectedDateKey] || [];

  return (
    <div className="bg-white dark:bg-gray-900 border rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <CalendarIcon className="w-6 h-6 text-indigo-600" />
        Réserver un rendez-vous avec {doctorName}
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
            <div className="text-xs mb-1">{format(date, 'EEE', { locale: fr })}</div>
            <div>{format(date, 'd', { locale: fr })}</div>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">
          Créneaux disponibles le {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
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
          <p className="text-gray-500">Aucun créneau disponible pour ce jour.</p>
        )}
      </div>
      {requiresConfirmation && (
        <p className="mt-4 text-sm text-gray-600">
          Note : Ce médecin nécessite une confirmation manuelle pour les rendez-vous.
        </p>
      )}
    </div>
  );
}