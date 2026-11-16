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
  blockedPeriods?: { startDate: string; endDate: string }[];
}

export function Calendar({
  selectedDate,
  availableSlots,
  onDateSelect,
  onTimeSelect,
  selectedTime,
  isSlotBooked = () => false, // Default to false if not provided
  blockedPeriods = [],
}: CalendarProps) {
  // Mock calendar implementation (replace with your actual calendar logic)
  const handleDateClick = (date: Date) => {
    onDateSelect(date);
  };
  const isDateBlocked = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return blockedPeriods.some((period) => dateKey >= period.startDate && dateKey <= period.endDate);
  };
  const selectedDateBlocked = isDateBlocked(selectedDate);

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
        {dates.map((date) => {
          const blocked = isDateBlocked(date);
          return (
          <button
            key={date.toISOString()}
            onClick={() => handleDateClick(date)}
            disabled={blocked}
            className={clsx(
              'p-2 rounded-lg text-sm font-medium transition-colors',
              blocked
                ? 'bg-red-600 text-white cursor-not-allowed opacity-80'
                : isSameDay(date, selectedDate)
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-blue-50 dark:hover:bg-gray-600 dark:hover:text-white'
            )}
            title={blocked ? 'Médecin absent' : undefined}
          >
            <div className="text-xs mb-1">{format(date, 'EEE', { locale: fr })}</div>
            <div>{format(date, 'd', { locale: fr })}</div>
          </button>
          );
        })}
      </div>

      {/* Time Slots */}
      <div>
        <h3 className="text-sm font-medium mb-2">
          Créneaux disponibles pour le {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
        </h3>
        {selectedDateBlocked ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
            Le médecin est absent ce jour-là. Choisissez une autre date.
          </p>
        ) : availableSlots.length === 0 ? (
          <p className="text-gray-500">Aucun créneau disponible</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 ">
            {availableSlots.map((time) => (
              <button
                key={time}
                onClick={() => onTimeSelect(time)}
                disabled={isSlotBooked(time)}
                className={clsx(
                  'p-2 rounded-lg text-sm font-medium transition-colors',
                  selectedTime === time
                    ? 'bg-indigo-600 text-white dark:hover:bg-gray-600 dark:hover:text-white '
                    : isSlotBooked(time)
                    ? 'bg-gray-200 text-gray-500 opacity-50 cursor-not-allowed'
                    : 'border border-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600 dark:hover:text-black '
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
