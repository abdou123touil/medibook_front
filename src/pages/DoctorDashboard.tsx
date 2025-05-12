import React, { useState, useEffect } from 'react';
import { format, addDays, isWithinInterval, parseISO, parse, formatDistanceToNow, isBefore, isAfter, addMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Settings,
  Video,
} from 'lucide-react';
import { Appointment } from '../types';
import { AvailabilityManager } from '../components/AvailabilityManager';
import { AppointmentHistoryModal } from '../components/AppointmentHistoryModal';
import { TeleconsultationModal } from '../components/TeleconsultationModal';
import { useAuthStore } from '../store/auth';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface ExtendedAppointment extends Appointment {
  teleconsultation?: { jitsiUrl: string; status: string };
}

export function DoctorDashboard() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { user } = useAuthStore();
  const [appointments, setAppointments] = useState<ExtendedAppointment[]>([]);
  const [historicAppointments, setHistoricAppointments] = useState<ExtendedAppointment[]>([]);
  const [availability, setAvailability] = useState<{ [date: string]: string[] }>({});
  const [availableSlotsIn14Days, setAvailableSlotsIn14Days] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTeleconsultationModalOpen, setIsTeleconsultationModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ExtendedAppointment | null>(null);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const today = new Date();
  const futureDate = addDays(today, 14);

  // State for timers
  const [timers, setTimers] = useState<{ [key: string]: string | null }>({});

  if (location.pathname === '/doctor/statistics') {
    console.warn('DoctorDashboard should not render for /doctor/statistics');
  }

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token');
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const doctorId = user?.id || storedUser?.data?.id;
      console.log('Fetching appointments for doctorId:', doctorId);

      if (!doctorId) {
        throw new Error(t('errorDoctorIdNotFound'));
      }

      const startOfWeek = new Date(today.setHours(0, 0, 0, 0));
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

      const response = await fetch(
        `http://localhost:3000/api/appointments/doctor/${doctorId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to fetch appointments:', response.status, errorData);
        throw new Error(t('errorFetchAppointments'));
      }

      const data = await response.json();
      console.log('Appointments response:', data);

      if (!Array.isArray(data.appointments)) {
        throw new Error(t('errorUnexpectedResponse'));
      }

      const upcomingAppointments = data.appointments.filter((apt: ExtendedAppointment) => {
        const aptDate = new Date(apt.date);
        return isWithinInterval(aptDate, { start: startOfWeek, end: endOfWeek });
      });

      const historicFiltered = data.appointments.filter(
        (apt: ExtendedAppointment) => apt.status === 'completed' || apt.status === 'cancelled'
      );

      setAppointments(upcomingAppointments);
      setHistoricAppointments(historicFiltered);
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('errorLoadAppointments'));
      setAppointments([]);
      setHistoricAppointments([]);
    }
  };

  const fetchAvailability = async () => {
    try {
      const token = localStorage.getItem('token');
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const doctorId = user?.id || storedUser?.data?.id;
      console.log('Fetching availability for doctorId:', doctorId, 'with token:', token);

      if (!doctorId) {
        throw new Error(t('errorDoctorIdNotFound'));
      }

      const response = await fetch(
        `http://localhost:3000/api/users/get-availability?userId=${doctorId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to fetch availability:', response.status, errorData);
        throw new Error(t('errorFetchAvailability'));
      }

      const data = await response.json();
      console.log('Availability response:', data);

      if (!data.availability) {
        throw new Error(t('errorNoAvailabilityData'));
      }

      const cleanedAvailability: { [date: string]: string[] } = {};
      for (const [date, times] of Object.entries(data.availability)) {
        if (date !== '$*' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          cleanedAvailability[date] = times;
        }
      }

      setAvailability(cleanedAvailability);
      setRequiresConfirmation(data.requiresConfirmation);

      let slotsCount = 0;
      const currentTime = format(today, 'HH:mm');
      Object.entries(cleanedAvailability).forEach(([date, times]) => {
        const dateObj = parseISO(date);
        if (isWithinInterval(dateObj, { start: today, end: futureDate })) {
          const validTimes =
            date === format(today, 'yyyy-MM-dd')
              ? times.filter((time) => time > currentTime)
              : times;
          slotsCount += validTimes.length;
        }
      });

      setAvailableSlotsIn14Days(slotsCount);
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('errorLoadAvailability'));
      setAvailability({});
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: 'accepted' | 'cancelled'
  ) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/appointments/${appointmentId}/${status}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('errorUpdateAppointment'));
      }

      const updatedAppointment = await response.json();

      setAppointments((prevAppointments) =>
        prevAppointments.map((apt) =>
          apt._id === appointmentId ? updatedAppointment.appointment : apt
        )
      );

      if (status === 'cancelled') {
        const cancelledAppointment = appointments.find(
          (apt) => apt._id === appointmentId
        );
        if (cancelledAppointment) {
          setHistoricAppointments((prevHistoricAppointments) => [
            ...prevHistoricAppointments,
            { ...cancelledAppointment, status },
          ]);
          setAppointments((prevAppointments) =>
            prevAppointments.filter((apt) => apt._id !== appointmentId)
          );
        }
      }

      toast.success(t(status === 'accepted' ? 'appointmentAccepted' : 'appointmentCancelled'));
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('errorTryAgain'));
    }
  };

  const updateRequiresConfirmation = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error(t('errorPleaseLogin'));
        return;
      }

      const newValue = !requiresConfirmation;
      const response = await fetch('http://localhost:3000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requiresConfirmation: newValue,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setRequiresConfirmation(newValue);
        toast.success(t('confirmationPreferenceUpdated'));
      } else {
        throw new Error(data.error || t('errorUpdate'));
      }
    } catch (error) {
      console.error('Error during update:', error);
      toast.error(t('errorServerUpdate'));
    }
  };

  const completeAppointment = async (appointmentId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/appointments/${appointmentId}/complete`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('errorCompleteAppointment'));
      }

      const updatedAppointment = await response.json();
      setAppointments((prevAppointments) =>
        prevAppointments.map((apt) =>
          apt._id === appointmentId ? updatedAppointment.appointment : apt
        )
      );
      setHistoricAppointments((prevHistoricAppointments) => [
        ...prevHistoricAppointments,
        updatedAppointment.appointment,
      ]);
      setAppointments((prevAppointments) =>
        prevAppointments.filter((apt) => apt._id !== appointmentId)
      );
      toast.success(t('appointmentCompleted'));
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('errorTryAgain'));
    }
  };

  const openTeleconsultation = (appointment: ExtendedAppointment) => {
    if (appointment.status !== "accepted") {
      toast.error(t("appointmentNotAccepted"));
      return;
    }
    if (!appointment.teleconsultation?.jitsiUrl) {
      toast.error(t("noTeleconsultationLink"));
      return;
    }
    setSelectedAppointment(appointment);
    setIsTeleconsultationModalOpen(true);
  };

  const openHistoricModal = () => {
    setIsModalOpen(true);
  };

  const closeHistoricModal = () => {
    setIsModalOpen(false);
  };

  // Update timers for teleconsultation appointments
  useEffect(() => {
    const updateTimers = () => {
      const newTimers: { [key: string]: string | null } = {};
      appointments.forEach((appointment) => {
        if (appointment.isTeleconsultation && appointment.status === "accepted") {
          const dateStr = new Date(appointment.date).toISOString().split('T')[0];
          const appointmentDateTime = parse(
            `${dateStr} ${appointment.time}`,
            'yyyy-MM-dd HH:mm',
            new Date()
          );
          const thirtyMinutesAfter = addMinutes(appointmentDateTime, 30);
          const now = new Date();

          if (isBefore(now, appointmentDateTime)) {
            const distance = formatDistanceToNow(appointmentDateTime, {
              locale: i18n.language === 'fr' ? fr : undefined,
              addSuffix: false,
            });
            newTimers[appointment._id] = `${t('startsIn')} ${distance}`;
          } else if (isAfter(now, appointmentDateTime) && isBefore(now, thirtyMinutesAfter)) {
            newTimers[appointment._id] = t('consultationInProgress');
          } else {
            newTimers[appointment._id] = t('consultationEnded');
          }
        }
      });
      setTimers(newTimers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [appointments, i18n.language, t]);

  // Function to check if the join button should be enabled
  const isJoinButtonEnabled = (appointment: ExtendedAppointment) => {
    if (!appointment.isTeleconsultation || appointment.status !== "accepted") {
      return false;
    }
    const dateStr = new Date(appointment.date).toISOString().split('T')[0];
    const appointmentDateTime = parse(
      `${dateStr} ${appointment.time}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    const fiveMinutesBefore = addMinutes(appointmentDateTime, -5);
    const thirtyMinutesAfter = addMinutes(appointmentDateTime, 30);
    const now = new Date();
    return isWithinInterval(now, {
      start: fiveMinutesBefore,
      end: thirtyMinutesAfter,
    });
  };

  // Function to check if the complete button should be enabled
  const isCompleteButtonEnabled = (appointment: ExtendedAppointment) => {
    return appointment.status === "accepted" || appointment.status === "completed";
  };

  useEffect(() => {
    fetchAppointments();
    fetchAvailability();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        <div className="dark:text-indigo-400 dark:bg-gray-900 border bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-3xl font-bold dark:text-indigo-400 text-gray-900 mb-8">
            {t('doctorDashboard')}
          </h1>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="bg-indigo-50 dark:bg-gray-900 border rounded-lg p-6">
              <h2 className="text-xl dark:text-indigo-400 font-semibold mb-4 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                {t('weeklyAppointments')}
              </h2>
              <div className="text-2xl font-bold text-indigo-600">{appointments.length}</div>
              <p className="text-gray-600">{t('scheduledAppointments')}</p>
            </div>

            <div className="bg-green-50 dark:bg-gray-700 border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 dark:text-indigo-400 text-green-600" />
                {t('completedConsultations')}
              </h2>
              <div className="text-2xl font-bold text-green-600">
                {historicAppointments.filter((apt) => apt.status === 'completed').length}
              </div>
              <p className="text-gray-600">{t('thisWeek')}</p>
            </div>

            <div className="bg-blue-50 dark:bg-gray-500 border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 dark:text-indigo-400 text-blue-600" />
                {t('availableSlots')}
              </h2>
              <div className="text-2xl font-bold dark:text-indigo-700 text-blue-600">
                {availableSlotsIn14Days}
              </div>
              <p className="text-gray-600 dark:text-gray-300">{t('next14Days')}</p>
            </div>
          </div>
        </div>

        <div className="dark:bg-gray-900 border bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            {t('bookingSettings')}
          </h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresConfirmation}
                onChange={updateRequiresConfirmation}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              {t('requireManualConfirmation')}
            </label>
            <p className="text-sm text-gray-600">
              {requiresConfirmation
                ? t('manualConfirmationRequired')
                : t('autoAcceptAppointments')}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">{t('upcomingAppointments')}</h2>
            <div className="space-y-4">
              {appointments.length === 0 ? (
                <p className="text-gray-600">{t('noAppointmentsThisWeek')}</p>
              ) : (
                appointments
                  .sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time}`);
                    const dateB = new Date(`${b.date}T${b.time}`);
                    return dateA.getTime() - dateB.getTime();
                  })
                  .map((appointment) => (
                    <div
                      key={appointment._id}
                      className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm border"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">
                            {t('patient')}:{' '}
                            {appointment.patientId?.firstName || t('nameNotAvailable')}{' '}
                            {appointment.patientId?.lastName || t('nameNotAvailable')}
                          </h3>
                          <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                            <Clock className="w-4 h-4" />
                            {format(new Date(appointment.date), 'PPP', {
                              locale: i18n.language === 'fr' ? fr : undefined,
                            })}{' '}
                            {t('at')} {appointment.time}
                          </div>
                          <p className="mt-2 text-gray-700">{appointment.symptoms}</p>
                          <p
                            className={clsx(
                              'text-sm font-medium mt-1',
                              appointment.status === 'pending' && 'text-yellow-600',
                              appointment.status === 'accepted' && 'text-green-600',
                              appointment.status === 'completed' && 'text-blue-600',
                              appointment.status === 'cancelled' && 'text-red-600'
                            )}
                          >
                            {t('status')}: {t(appointment.status)}
                          </p>
                          {appointment.isTeleconsultation && appointment.status === "accepted" && (
                            <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                              {timers[appointment._id] || t('consultationEnded')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          {appointment.status === 'pending' && (
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, 'accepted')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-full"
                              title={t('accept')}
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                          {appointment.status === 'pending' && (
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, 'cancelled')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-full"
                              title={t('cancel')}
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          )}
                          {appointment.isTeleconsultation && appointment.status === "accepted" && (
                            <>
                              <button
                                onClick={() => openTeleconsultation(appointment)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                disabled={!appointment.teleconsultation?.jitsiUrl || !isJoinButtonEnabled(appointment)}
                                title={t('teleconsultation')}
                              >
                                <Video className="w-5 h-5" />
                                {t('joinTeleconsultation')}
                              </button>
                              {!appointment.teleconsultation?.jitsiUrl && (
                                <span className="text-sm text-red-600 dark:text-red-400">
                                  {t('noTeleconsultationLink')}
                                </span>
                              )}
                            </>
                          )}
                          {(appointment.status === "accepted" || appointment.status === "completed") && (
                            <button
                              onClick={() => completeAppointment(appointment._id)}
                              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              disabled={!isCompleteButtonEnabled(appointment)}
                              title={t('complete')}
                            >
                              {t('complete')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <button
              onClick={openHistoricModal}
              className="mt-4 px-4 py-2 transition-colors bg-indigo-600 text-white rounded-full"
            >
              {t('history')}
            </button>
          </div>

          <div>
            <AvailabilityManager
              onUpdateAvailability={setAvailability}
              appointments={appointments}
            />
          </div>
        </div>
      </div>

      <AppointmentHistoryModal
        isOpen={isModalOpen}
        onClose={closeHistoricModal}
        appointments={historicAppointments}
      />
      {selectedAppointment && (
        <TeleconsultationModal
          isOpen={isTeleconsultationModalOpen}
          onClose={() => {
            setIsTeleconsultationModalOpen(false);
            setSelectedAppointment(null);
          }}
          jitsiUrl={selectedAppointment.teleconsultation?.jitsiUrl || ""}
          appointment={{
            date: selectedAppointment.date,
            time: selectedAppointment.time,
            status: selectedAppointment.status,
          }}
        />
      )}
    </div>
  );
}