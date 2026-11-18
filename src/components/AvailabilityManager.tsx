import React, { useState, useEffect } from 'react';
import { apiFetch } from "../lib/api";
import { format, addDays, startOfWeek } from 'date-fns';
import { ar, enUS, fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus, X, Ban, Repeat, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/auth';
import { Appointment } from '../types';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface AvailabilityManagerProps {
  onUpdateAvailability: (availability: { [key: string]: string[] }) => void;
  appointments: Appointment[];
}

interface DoctorAbsence {
  _id: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

const DOCTOR_TIME_ZONE = 'Africa/Tunis';

function getDoctorDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DOCTOR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDoctorTimeKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DOCTOR_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.hour}:${values.minute}`;
}

function getDoctorCalendarDate(date: Date) {
  const [year, month, day] = getDoctorDateKey(date).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function AvailabilityManager({ onUpdateAvailability, appointments }: AvailabilityManagerProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => getDoctorCalendarDate(new Date()));
  const [sundaySetupDate, setSundaySetupDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{ [key: string]: string[] }>({});
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [isSavingAbsence, setIsSavingAbsence] = useState(false);
  const [absences, setAbsences] = useState<DoctorAbsence[]>([]);
  const [selectedAbsence, setSelectedAbsence] = useState<DoctorAbsence | null>(null);
  const [isCancellingAbsence, setIsCancellingAbsence] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enUS : fr;

  useEffect(() => {
    const refreshCurrentTime = () => setCurrentTime(new Date());
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshCurrentTime();
    };
    const interval = window.setInterval(refreshCurrentTime, 10_000);
    window.addEventListener('focus', refreshCurrentTime);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshCurrentTime);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const todayKey = getDoctorDateKey(currentTime);
  const currentDoctorTime = getDoctorTimeKey(currentTime);
  const today = getDoctorCalendarDate(currentTime);
  const calendarStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = [...Array(35)].map((_, i) => addDays(calendarStart, i));

  // If the dashboard stays open overnight, move the selection forward to the new day.
  useEffect(() => {
    if (format(selectedDate, 'yyyy-MM-dd') < todayKey) {
      setSelectedDate(today);
    }
  }, [todayKey, selectedDate, today]);

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00"
  ];

  // Fetch availability data from the backend on component mount
  useEffect(() => {
    const userId = user?.data?.id;
    if (!userId || !isAuthenticated) {
      toast.error(t('authenticationRequired'));
      return;
    }

    const fetchAvailability = async () => {
      try {
        
        const response = await apiFetch(`http://localhost:3000/api/users/get-availability?userId=${userId}`, {
          method: 'GET',
        });

        const data = await response.json();
        

        if (response.ok && data.availability) {
          
          setAvailability(data.availability);
          onUpdateAvailability(data.availability);
          try {
            const absencesResponse = await apiFetch('http://localhost:3000/api/users/doctor-absences', {
            });
            if (absencesResponse.ok) {
              const absencesData = await absencesResponse.json();
              setAbsences(absencesData.absences || []);
            }
          } catch (error) {
            
          }
        } else {
          
          toast.error(t('availabilityLoadError'));
          setAvailability({});
          onUpdateAvailability({});
        }
      } catch (error) {
        
        toast.error(t('availabilityLoadError'));
        setAvailability({});
        onUpdateAvailability({});
      }
    };

    fetchAvailability();
  }, []);

  // Toggle time slot availability
  const toggleTimeSlot = async (time: string) => {
    if (isTimeSlotDisabled(time) || (isSunday && !sundayAvailabilityEnabled)) return;
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
    const previousSundaySetupDate = sundaySetupDate;
    if (isSunday) setSundaySetupDate(newSlots.length > 0 ? dateKey : null);
    setAvailability(updatedAvailability);
    onUpdateAvailability(updatedAvailability);

    // Make API call to update availability in the backend
    try {
      const userId = user?.data?.id;
      
      const response = await apiFetch('http://localhost:3000/api/users/update-availability', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          availability: updatedAvailability,
        }),
      });

      const data = await response.json();
      

      if (response.ok) {
        
        toast.success(t('availabilityUpdated'));
      } else {
        
        toast.error(data.error || t('availabilityUpdateError'));
        setSundaySetupDate(previousSundaySetupDate);
        setAvailability(availability);
        onUpdateAvailability(availability);
      }
    } catch (error) {
      
      toast.error(t('availabilityUpdateError'));
      setSundaySetupDate(previousSundaySetupDate);
      setAvailability(availability);
      onUpdateAvailability(availability);
    }
  };

  const openAbsenceModal = () => {
    const dateKey = format(selectedDate < new Date() ? new Date() : selectedDate, 'yyyy-MM-dd');
    setAbsenceStartDate(dateKey);
    setAbsenceEndDate(dateKey);
    setAbsenceReason('');
    setIsAbsenceModalOpen(true);
  };

  const saveAbsence = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!absenceStartDate || !absenceEndDate || absenceStartDate > absenceEndDate || isSavingAbsence) return;
    setIsSavingAbsence(true);
    try {
      const response = await apiFetch('http://localhost:3000/api/users/doctor-absence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startDate: absenceStartDate, endDate: absenceEndDate, reason: absenceReason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('absenceSaveError'));
      setAvailability(data.availability || {});
      onUpdateAvailability(data.availability || {});
      if (data.absence) setAbsences((current) => [...current, data.absence]);
      setIsAbsenceModalOpen(false);
      const count = Number(data.cancelledAppointments) || 0;
      toast.success(count ? t('absenceSavedPatients', { count }) : t('absenceSaved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('absenceSaveError'));
    } finally {
      setIsSavingAbsence(false);
    }
  };

  const cancelAbsence = async () => {
    if (!selectedAbsence || isCancellingAbsence) return;
    setIsCancellingAbsence(true);
    try {
      const response = await apiFetch(`http://localhost:3000/api/users/doctor-absence/${selectedAbsence._id}/cancel`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('cancelBlockError'));
      setAvailability(data.availability || {});
      onUpdateAvailability(data.availability || {});
      setAbsences((current) => current.filter((absence) => absence._id !== selectedAbsence._id));
      setSelectedAbsence(null);
      toast.success(data.message || t('blockCancelled'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cancelBlockError'));
    } finally {
      setIsCancellingAbsence(false);
    }
  };

  const repeatWeeklySchedule = async () => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const template = availability[dateKey] || [];
    if (template.length === 0) {
      toast.error(t('addSlotsBeforeRepeat'));
      return;
    }

    const updatedAvailability = { ...availability };
    let copiedDays = 0;
    for (let week = 1; week <= 4; week += 1) {
      const targetKey = format(addDays(selectedDate, week * 7), 'yyyy-MM-dd');
      const hasBooking = appointments.some((appointment) =>
        format(new Date(appointment.date), 'yyyy-MM-dd') === targetKey &&
        ['pending', 'accepted'].includes(appointment.status)
      );
      if (hasBooking) continue;
      updatedAvailability[targetKey] = [...template];
      copiedDays += 1;
    }

    if (copiedDays === 0) {
      toast.error(t('noRepeatableDays'));
      return;
    }

    const previousAvailability = availability;
    setAvailability(updatedAvailability);
    onUpdateAvailability(updatedAvailability);
    try {
      const response = await apiFetch('http://localhost:3000/api/users/update-availability', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ availability: updatedAvailability }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('repeatAvailabilityError'));
      toast.success(t('availabilityRepeated', { count: copiedDays }));
    } catch (error) {
      setAvailability(previousAvailability);
      onUpdateAvailability(previousAvailability);
      toast.error(error instanceof Error ? error.message : t('repeatAvailabilityError'));
    }
  };

  const isTimeSlotInPast = (time: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    if (dateKey < todayKey || (dateKey === todayKey && time <= currentDoctorTime)) return true;
    return false;
  };

  // A past or already booked time cannot be changed.
  const isTimeSlotDisabled = (time: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    if (isTimeSlotInPast(time)) return true;
    return appointments.some(appointment => 
      format(new Date(appointment.date), 'yyyy-MM-dd') === dateKey &&
      appointment.time === time &&
      ['pending', 'accepted'].includes(appointment.status)
    );
  };

  // Get patient name for a booked time slot
  const getPatientName = (time: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const appointment = appointments.find(appointment =>
      format(new Date(appointment.date), 'yyyy-MM-dd') === dateKey &&
      appointment.time === time &&
      ['pending', 'accepted'].includes(appointment.status)
    );
    return appointment 
      ? `${appointment.patientId?.firstName || 'Nom'} ${appointment.patientId?.lastName || 'inconnu'}`
      : '';
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateSlots = availability && availability[selectedDateKey] ? availability[selectedDateKey] : [];
  const isSunday = selectedDate.getDay() === 0;
  const sundayAvailabilityEnabled = !isSunday || selectedDateSlots.length > 0 || sundaySetupDate === selectedDateKey;
  const affectedAppointmentsCount = appointments.filter((appointment) => {
    const appointmentDate = format(new Date(appointment.date), 'yyyy-MM-dd');
    return !!absenceStartDate && !!absenceEndDate
      && appointmentDate >= absenceStartDate
      && appointmentDate <= absenceEndDate
      && ['pending', 'accepted'].includes(appointment.status);
  }).length;
  const getAbsenceForDate = (date: string) => absences.find((absence) =>
    date >= absence.startDate && date <= absence.endDate
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 p-5 text-white sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <CalendarIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">{t('doctorDashboard')}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{t('manageAvailability')}</h2>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
      <div className="mb-6 grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDays.map((date) => (
          (() => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const isPastDay = dateKey < todayKey;
            const isSelected = dateKey === selectedDateKey;
            const absence = getAbsenceForDate(dateKey);
            const isClosedSunday = date.getDay() === 0
              && !(availability[dateKey] || []).length
              && sundaySetupDate !== dateKey;
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDate(date)}
                disabled={isPastDay}
                aria-pressed={isSelected}
                title={isClosedSunday ? t('sundayAvailabilityClosed') : undefined}
                className={clsx(
                  'min-h-[66px] rounded-xl border px-1 py-2 text-center transition sm:min-h-[74px] sm:px-2',
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : absence
                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                      : isClosedSunday
                        ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800',
                  isPastDay && 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-45 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600',
                  dateKey === todayKey && !isSelected && 'ring-1 ring-inset ring-indigo-500'
                )}
              >
                <span className="block text-[10px] font-semibold uppercase leading-4 sm:text-xs">{format(date, 'EEE', { locale: dateLocale })}</span>
                <span className="mt-0.5 block text-base font-bold leading-5 sm:text-lg">{format(date, 'd', { locale: dateLocale })}</span>
              </button>
            );
          })()
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
          {t('slotsForDate', { date: format(selectedDate, 'EEEE d MMMM', { locale: dateLocale }) })}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={repeatWeeklySchedule}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Repeat className="w-4 h-4" />
            {t('repeat4Weeks')}
          </button>
          <button
            onClick={openAbsenceModal}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            <Ban className="w-4 h-4" />
            {t('blockPeriod')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {isSunday && (
          <div className="col-span-full flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sun className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-900 dark:text-amber-100">
                {sundayAvailabilityEnabled ? t('sundayAvailabilityEnabled') : t('sundayAvailabilityClosed')}
              </p>
            </div>
            {!sundayAvailabilityEnabled && (
              <button
                type="button"
                onClick={() => setSundaySetupDate(selectedDateKey)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                {t('enableSundayAvailability')}
              </button>
            )}
          </div>
        )}
        {timeSlots.map((time) => {
          const blockedAbsence = getAbsenceForDate(selectedDateKey);
          const isBooked = appointments.some(appointment =>
            format(new Date(appointment.date), 'yyyy-MM-dd') === selectedDateKey &&
            appointment.time === time &&
            ['pending', 'accepted'].includes(appointment.status)
          );
          const patientName = getPatientName(time);
          const isPast = isTimeSlotInPast(time);
          const isDisabled = blockedAbsence
            ? isPast
            : isTimeSlotDisabled(time) || (isSunday && !sundayAvailabilityEnabled);

          return (
            <div key={time} className="relative group">
              <button
                type="button"
                onClick={() => blockedAbsence ? setSelectedAbsence(blockedAbsence) : toggleTimeSlot(time)}
                disabled={isDisabled}
                aria-pressed={selectedDateSlots.includes(time)}
                className={clsx(
                  'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-2 py-2 text-sm font-semibold transition',
                  blockedAbsence
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
                    : isBooked
                      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                      : selectedDateSlots.includes(time)
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800',
                  isDisabled && 'cursor-not-allowed opacity-45 hover:bg-inherit',
                  isPast && !blockedAbsence && 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                )}
              >
                {time}
                {blockedAbsence ? (
                  <Ban className="w-4 h-4" />
                ) : selectedDateSlots.includes(time) ? (
                  <X className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
              {isBooked && !blockedAbsence && patientName && (
                <div className="absolute z-10 hidden group-hover:block bg-slate-900 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  {t('patient')}: {patientName}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
      {isAbsenceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4" role="presentation">
          <form onSubmit={saveAbsence} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="doctor-absence-title">
            <h3 id="doctor-absence-title" className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('scheduleAbsence')}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t('absenceImpact')}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              {t('affectedAppointmentsCount', { count: affectedAppointmentsCount })}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t('from')}
                <input type="date" required min={format(new Date(), 'yyyy-MM-dd')} value={absenceStartDate} onChange={(event) => setAbsenceStartDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t('to')}
                <input type="date" required min={absenceStartDate || format(new Date(), 'yyyy-MM-dd')} value={absenceEndDate} onChange={(event) => setAbsenceEndDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
            </div>
            <label htmlFor="absence-reason" className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('optionalReason')}
            </label>
            <textarea id="absence-reason" value={absenceReason} onChange={(event) => setAbsenceReason(event.target.value)} maxLength={300} rows={3} placeholder={t('absenceReasonPlaceholder')} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isSavingAbsence} onClick={() => setIsAbsenceModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                {t('back')}
              </button>
              <button type="submit" disabled={isSavingAbsence || !absenceStartDate || !absenceEndDate || absenceStartDate > absenceEndDate} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isSavingAbsence ? t('saving') : t('confirmAndNotifyPatients')}
              </button>
            </div>
          </form>
        </div>
      )}
      {selectedAbsence && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4" role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="cancel-block-title">
            <h3 id="cancel-block-title" className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('blockedPeriod')}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t('dateRange', { start: format(new Date(`${selectedAbsence.startDate}T00:00:00`), 'P', { locale: dateLocale }), end: format(new Date(`${selectedAbsence.endDate}T00:00:00`), 'P', { locale: dateLocale }) })}
            </p>
            {selectedAbsence.reason && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('reason')}: {selectedAbsence.reason}</p>}
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {t('cancelBlockPrompt')}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isCancellingAbsence} onClick={() => setSelectedAbsence(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                {t('keepBlock')}
              </button>
              <button type="button" disabled={isCancellingAbsence} onClick={cancelAbsence} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-50">
                {isCancellingAbsence ? t('cancelling') : t('cancelBlock')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
