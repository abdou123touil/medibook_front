import React from 'react';
import { format, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

interface CalendarProps {
  selectedDate: Date;
  availableSlots: string[];
  onDateSelect: (date: Date) => void;
  onTimeSelect: (time: string) => void;
  selectedTime: string | null;
  isSlotBooked?: (time: string) => boolean; // Optional prop to check booked slots
}

export function Calendar({
  selectedDate,
  availableSlots,
  onDateSelect,
  onTimeSelect,
  selectedTime,
  isSlotBooked = () => false, // Default to false if not provided
}: CalendarProps) {
  // Mock calendar implementation (replace with your actual calendar logic)
  const handleDateClick = (date: Date) => {
    onDateSelect(date);
  };

  // Generate dates for the next 14 days (example)
  const startDate = new Date();
  const dates = [...Array(14)].map((_, i) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    return date;
  });

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <div className="grid grid-cols-7 gap-2">
        {dates.map((date) => (
          <button
            key={date.toISOString()}
            onClick={() => handleDateClick(date)}
            className={clsx(
              'p-2 rounded-lg text-sm font-medium transition-colors',
              isSameDay(date, selectedDate)
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-indigo-50'
            )}
          >
            <div className="text-xs mb-1">{format(date, 'EEE', { locale: fr })}</div>
            <div>{format(date, 'd', { locale: fr })}</div>
          </button>
        ))}
      </div>

      {/* Time Slots */}
      <div>
        <h3 className="text-sm font-medium mb-2">
          Créneaux disponibles pour le {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
        </h3>
        {availableSlots.length === 0 ? (
          <p className="text-gray-500">Aucun créneau disponible</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {availableSlots.map((time) => (
              <button
                key={time}
                onClick={() => onTimeSelect(time)}
                disabled={isSlotBooked(time)}
                className={clsx(
                  'p-2 rounded-lg text-sm font-medium transition-colors',
                  selectedTime === time
                    ? 'bg-indigo-600 text-white'
                    : isSlotBooked(time)
                    ? 'bg-gray-200 text-gray-500 opacity-50 cursor-not-allowed'
                    : 'border border-gray-200 hover:bg-indigo-50'
                )}
              >
                {time}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}