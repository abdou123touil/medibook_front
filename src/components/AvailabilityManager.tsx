import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus, X, Ban, Repeat } from 'lucide-react';
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
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [isSavingAbsence, setIsSavingAbsence] = useState(false);
  const { user } = useAuthStore();

  const startDate = startOfWeek(new Date(), { locale: fr });
  const weekDays = [...Array(35)].map((_, i) => addDays(startDate, i));

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
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/users/doctor-absence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startDate: absenceStartDate, endDate: absenceEndDate, reason: absenceReason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer cette absence.');
      setAvailability(data.availability || {});
      onUpdateAvailability(data.availability || {});
      setIsAbsenceModalOpen(false);
      const count = Number(data.cancelledAppointments) || 0;
      toast.success(count
        ? `Absence enregistrée. ${count} patient${count > 1 ? 's ont été prévenus' : ' a été prévenu'}.`
        : 'Période d’absence enregistrée.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer cette absence.');
    } finally {
      setIsSavingAbsence(false);
    }
  };

  const repeatWeeklySchedule = async () => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const template = availability[dateKey] || [];
    if (template.length === 0) {
      toast.error('Ajoutez d’abord des créneaux à cette journée.');
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
      toast.error('Aucun jour libre à mettre à jour dans les quatre prochaines semaines.');
      return;
    }

    const previousAvailability = availability;
    setAvailability(updatedAvailability);
    onUpdateAvailability(updatedAvailability);
    try {
      const response = await fetch('http://localhost:3000/api/users/update-availability', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ availability: updatedAvailability }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de répéter les disponibilités.');
      toast.success(`Disponibilités répétées sur ${copiedDays} semaines.`);
    } catch (error) {
      setAvailability(previousAvailability);
      onUpdateAvailability(previousAvailability);
      toast.error((error as Error).message);
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
  const affectedAppointmentsCount = appointments.filter((appointment) => {
    const appointmentDate = format(new Date(appointment.date), 'yyyy-MM-dd');
    return !!absenceStartDate && !!absenceEndDate
      && appointmentDate >= absenceStartDate
      && appointmentDate <= absenceEndDate
      && ['pending', 'accepted'].includes(appointment.status);
  }).length;

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
        <div className="flex gap-2">
          <button
            onClick={repeatWeeklySchedule}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            <Repeat className="w-4 h-4" />
            Répéter 4 semaines
          </button>
          <button
            onClick={openAbsenceModal}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            <Ban className="w-4 h-4" />
            Bloquer une période
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {timeSlots.map((time) => {
          const isBooked = appointments.some(appointment =>
            format(new Date(appointment.date), 'yyyy-MM-dd') === selectedDateKey &&
            appointment.time === time &&
            ['pending', 'accepted'].includes(appointment.status)
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
      {isAbsenceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4" role="presentation">
          <form onSubmit={saveAbsence} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800" role="dialog" aria-modal="true" aria-labelledby="doctor-absence-title">
            <h3 id="doctor-absence-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              Planifier une absence
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Les rendez-vous de cette période seront annulés et les disponibilités retirées. Chaque patient recevra le choix entre reprogrammer ou garder l’annulation.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100">
              {affectedAppointmentsCount} rendez-vous concerné{affectedAppointmentsCount > 1 ? 's' : ''}.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Du
                <input type="date" required min={format(new Date(), 'yyyy-MM-dd')} value={absenceStartDate} onChange={(event) => setAbsenceStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Au
                <input type="date" required min={absenceStartDate || format(new Date(), 'yyyy-MM-dd')} value={absenceEndDate} onChange={(event) => setAbsenceEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </label>
            </div>
            <label htmlFor="absence-reason" className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Motif (facultatif)
            </label>
            <textarea id="absence-reason" value={absenceReason} onChange={(event) => setAbsenceReason(event.target.value)} maxLength={300} rows={3} placeholder="Ex. congé, formation, indisponibilité personnelle" className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isSavingAbsence} onClick={() => setIsAbsenceModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Retour
              </button>
              <button type="submit" disabled={isSavingAbsence || !absenceStartDate || !absenceEndDate || absenceStartDate > absenceEndDate} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isSavingAbsence ? 'Enregistrement…' : 'Confirmer et prévenir les patients'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
