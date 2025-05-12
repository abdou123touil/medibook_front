import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus, X, Ban } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/auth';
import { Appointment } from '../types';
import toast from 'react-hot-toast';

interface AvailabilityManagerProps {
  onUpdateAvailability: (availability: { [key: string]: string[] }) => void;
  appointments: Appointment[];
}

export function AvailabilityManager({ onUpdateAvailability, appointments }: AvailabilityManagerProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availability, setAvailability] = useState<{ [key: string]: string[] }>({});
  const { user } = useAuthStore();

  const startDate = startOfWeek(new Date(), { locale: fr });
  const weekDays = [...Array(14)].map((_, i) => addDays(startDate, i));

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00"
  ];

  // Fetch availability data from the backend on component mount
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser?.data?.id;
    const token = localStorage.getItem('token');

    if (!userId || !token) {
      console.error('User ID or token is missing', { userId, token });
      toast.error('Utilisateur non authentifié.');
      return;
    }

    const fetchAvailability = async () => {
      try {
        console.log('Fetching availability for userId:', userId);
        const response = await fetch(`http://localhost:3000/api/users/get-availability?userId=${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();
        console.log('Availability response:', data);

        if (response.ok && data.availability) {
          console.log('Fetched availability:', data.availability);
          setAvailability(data.availability);
          onUpdateAvailability(data.availability);
        } else {
          console.error('Failed to fetch availability:', data.error || 'Unknown error');
          toast.error('Impossible de charger les disponibilités.');
          setAvailability({});
          onUpdateAvailability({});
        }
      } catch (error) {
        console.error('Error fetching availability:', error);
        toast.error('Erreur lors du chargement des disponibilités.');
        setAvailability({});
        onUpdateAvailability({});
      }
    };

    fetchAvailability();
  }, []);

  // Toggle time slot availability
  const toggleTimeSlot = async (time: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const currentSlots = availability[dateKey] || [];
    const newSlots = currentSlots.includes(time)
      ? currentSlots.filter(t => t !== time)
      : [...currentSlots, time].sort();

    // Update availability locally
    const updatedAvailability = {
      ...availability,
      [dateKey]: newSlots,
    };
    setAvailability(updatedAvailability);
    onUpdateAvailability(updatedAvailability);

    // Make API call to update availability in the backend
    try {
      const token = localStorage.getItem('token');
      const userId = user?.data?.id;
      console.log('Sending availability update:', { userId, availability: updatedAvailability });
      const response = await fetch('http://localhost:3000/api/users/update-availability', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          availability: updatedAvailability,
        }),
      });

      const data = await response.json();
      console.log('Update availability response:', data);

      if (response.ok) {
        console.log('Disponibilité mise à jour avec succès.');
        toast.success('Disponibilité mise à jour.');
      } else {
        console.error('Erreur lors de la mise à jour de la disponibilité:', data.error);
        toast.error(data.error || 'Erreur lors de la mise à jour de la disponibilité.');
        setAvailability(availability);
        onUpdateAvailability(availability);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la disponibilité:', error);
      toast.error('Erreur serveur lors de la mise à jour de la disponibilité.');
      setAvailability(availability);
      onUpdateAvailability(availability);
    }
  };

  // Block an entire day
  const blockDay = async () => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const updatedAvailability = { ...availability };
    delete updatedAvailability[dateKey];

    setAvailability(updatedAvailability);
    onUpdateAvailability(updatedAvailability);

    try {
      const token = localStorage.getItem('token');
      const userId = user?.data?.id;
      const response = await fetch('http://localhost:3000/api/users/update-availability', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          availability: updatedAvailability,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Journée bloquée avec succès.');
      } else {
        toast.error(data.error || 'Erreur lors du blocage de la journée.');
        setAvailability(availability);
        onUpdateAvailability(availability);
      }
    } catch (error) {
      console.error('Erreur lors du blocage de la journée:', error);
      toast.error('Erreur serveur lors du blocage de la journée.');
      setAvailability(availability);
      onUpdateAvailability(availability);
    }
  };

  // Determine if a time slot should be disabled (past or booked)
  const isTimeSlotDisabled = (time: string) => {
    if (isSameDay(selectedDate, new Date())) {
      const currentTime = format(new Date(), 'HH:mm');
      if (time <= currentTime) {
        return true;
      }
    }

    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return appointments.some(appointment => 
      format(new Date(appointment.date), 'yyyy-MM-dd') === dateKey &&
      appointment.time === time &&
      appointment.status === 'pending'
    );
  };

  // Get patient name for a booked time slot
  const getPatientName = (time: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const appointment = appointments.find(appointment =>
      format(new Date(appointment.date), 'yyyy-MM-dd') === dateKey &&
      appointment.time === time &&
      appointment.status === 'pending'
    );
    return appointment 
      ? `${appointment.patientId?.firstName || 'Nom'} ${appointment.patientId?.lastName || 'inconnu'}`
      : '';
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateSlots = availability && availability[selectedDateKey] ? availability[selectedDateKey] : [];

  return (
    <div className="bg-white dark:bg-gray-900 border rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <CalendarIcon className="w-6 h-6 text-indigo-600" />
        Gérer vos disponibilités
      </h2>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {weekDays.map((date) => (
          <button
            key={date.toISOString()}
            onClick={() => setSelectedDate(date)}
            className={clsx(
              "p-2 rounded-lg text-sm font-medium transition-colors",
              format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                ? "bg-indigo-600 text-white"
                : "hover:bg-indigo-50"
            )}
          >
            <div className="text-xs mb-1">{format(date, 'EEE', { locale: fr })}</div>
            <div>{format(date, 'd', { locale: fr })}</div>
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">
          Créneaux pour le {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
        </h3>
        <button
          onClick={blockDay}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Ban className="w-4 h-4" />
          Bloquer ce jour
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {timeSlots.map((time) => {
          const isBooked = appointments.some(appointment =>
            format(new Date(appointment.date), 'yyyy-MM-dd') === selectedDateKey &&
            appointment.time === time &&
            appointment.status === 'pending'
          );
          const patientName = getPatientName(time);

          return (
            <div key={time} className="relative group">
              <button
                onClick={() => toggleTimeSlot(time)}
                disabled={isTimeSlotDisabled(time)}
                className={clsx(
                  "p-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 w-full",
                  selectedDateSlots.includes(time) && !isBooked
                    ? "bg-indigo-600 text-white"
                    : isBooked
                    ? "bg-yellow-300 text-black"
                    : "border border-gray-200 hover:bg-indigo-50",
                  isTimeSlotDisabled(time) && "opacity-50 cursor-not-allowed"
                )}
              >
                {time}
                {selectedDateSlots.includes(time) ? (
                  <X className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
              {isBooked && patientName && (
                <div className="absolute z-10 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  Patient: {patientName}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}