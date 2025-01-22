import React from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import clsx from 'clsx';

interface CalendarProps {
  selectedDate: Date;
  availableSlots: string[];
  onDateSelect: (date: Date) => void;
  onTimeSelect: (time: string) => void;
  selectedTime: string | null;
}

export function Calendar({ selectedDate, availableSlots, onDateSelect, onTimeSelect, selectedTime }: CalendarProps) {
  const startDate = startOfWeek(new Date(), { locale: fr });
  const weekDays = [...Array(14)].map((_, i) => addDays(startDate, i));

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          Sélectionnez une date
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((date) => (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={clsx(
                "p-2 rounded-lg text-sm font-medium transition-colors",
                isSameDay(date, selectedDate)
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-indigo-50"
              )}
            >
              <div className="text-xs mb-1">{format(date, 'EEE', { locale: fr })}</div>
              <div>{format(date, 'd', { locale: fr })}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          Créneaux disponibles
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {availableSlots.map((time) => (
            <button
              key={time}
              onClick={() => onTimeSelect(time)}
              className={clsx(
                "p-2 rounded-lg text-sm font-medium transition-colors",
                time === selectedTime
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-indigo-50"
              )}
            >
              {time}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}