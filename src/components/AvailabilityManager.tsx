import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/auth';

export function AvailabilityManager({ onUpdateAvailability }: AvailabilityManagerProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availability, setAvailability] = useState<{ [key: string]: string[] }>({});
  const { user } = useAuthStore();  // Get user data from the hook

  const startDate = startOfWeek(new Date(), { locale: fr });
  const weekDays = [...Array(14)].map((_, i) => addDays(startDate, i));

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", 
    "13:00", "14:00", "15:00", "16:00", "17:00"
  ];

  // Fetch availability data from the backend on component mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user?.data?.id;  // Ensure user.data exists
  
    if (userId) {
      const fetchAvailability = async () => {
        try {
          const response = await fetch(`http://localhost:3000/api/users/get-availability?userId=${userId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')?.token}`,
            },
          });
  
          if (response.ok) {
            const data = await response.json();
            setAvailability(data.availability);  // Set the fetched availability
          } else {
            console.error('Failed to fetch availability');
          }
        } catch (error) {
          console.error('Error fetching availability:', error);
        }
      };
  
      fetchAvailability();
    } else {
      console.error('User ID is not available');
    }
  }, [user?.data?.id]);  // Add user?.data?.id to dependency array
   // Run this effect when the user ID changes
  // Toggle time slot availability
  const toggleTimeSlot = async (time: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const currentSlots = availability[dateKey] || [];
    const newSlots = currentSlots.includes(time)
      ? currentSlots.filter(t => t !== time)
      : [...currentSlots, time].sort();

    // Update availability locally
    setAvailability({
      ...availability,
      [dateKey]: newSlots,
    });

    // Make API call to update availability in the backend
    try {
      const response = await fetch('http://localhost:3000/api/users/update-availability', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
         // Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: user?.data?.id,
          availability: {
            ...availability,
            [dateKey]: newSlots,
          },
        }),
      });

      if (response.ok) {
        console.log('Disponibilité mise à jour avec succès.');
      } else {
        console.error('Erreur lors de la mise à jour de la disponibilité.');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la disponibilité:', error);
    }
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
const selectedDateSlots = availability[selectedDateKey] || [];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
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

    <div>
      <h3 className="text-lg font-medium mb-4">
        Créneaux pour le {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {timeSlots.map((time) => (
          <button
            key={time}
            onClick={() => toggleTimeSlot(time)}
            className={clsx(
              "p-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
              selectedDateSlots.includes(time)
                ? "bg-indigo-600 text-white"
                : "border border-gray-200 hover:bg-indigo-50"
            )}
          >
            {time}
            {selectedDateSlots.includes(time) ? (
              <X className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        ))}
      </div>
    </div>
  </div>
  );
}
