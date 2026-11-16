import React, { useEffect, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { ar, enUS, fr } from 'date-fns/locale';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const locale = i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enUS : fr;
  // Mock calendar implementation (replace with your actual calendar logic)
  const handleDateClick = (date: Date) => {
    onDateSelect(date);
  };
  const isDateBlocked = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return blockedPeriods.some((period) => dateKey >= period.startDate && dateKey <= period.endDate);
  };
  const isSlotInPast = (time: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const todayKey = format(now, 'yyyy-MM-dd');
    return dateKey < todayKey || (dateKey === todayKey && time <= format(now, 'HH:mm'));
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
              'p-2 rounded-xl text-sm font-medium transition-colors',
              blocked
                ? 'bg-red-600 text-white cursor-not-allowed opacity-80'
                : isSameDay(date, selectedDate)
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-blue-50 dark:hover:bg-slate-700 dark:hover:text-white'
            )}
            title={blocked ? t('doctorAbsent') : undefined}
          >
            <div className="text-xs mb-1">{format(date, 'EEE', { locale })}</div>
            <div>{format(date, 'd', { locale })}</div>
          </button>
          );
        })}
      </div>

      {/* Time Slots */}
      <div>
        <h3 className="text-sm font-medium mb-2">
          {t('availableSlotsForDate', { date: format(selectedDate, 'EEEE d MMMM', { locale }) })}
        </h3>
        {selectedDateBlocked ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
            {t('doctorAbsentDay')}
          </p>
        ) : availableSlots.length === 0 ? (
          <p className="text-slate-500">{t('noAvailableSlots')}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 ">
            {availableSlots.map((time) => {
              const unavailable = isSlotBooked(time) || isSlotInPast(time);
              return (
              <button
                key={time}
                onClick={() => onTimeSelect(time)}
                disabled={unavailable}
                className={clsx(
                  'p-2 rounded-xl text-sm font-medium transition-colors',
                  unavailable
                    ? 'border border-slate-200 bg-slate-100 text-slate-400 opacity-70 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                    : selectedTime === time
                    ? 'bg-indigo-600 text-white dark:hover:bg-slate-700 dark:hover:text-white '
                    : 'border border-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 dark:hover:text-black '
                )}
              >
                {time}
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
