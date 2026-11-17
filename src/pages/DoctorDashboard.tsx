import React, { useState, useEffect } from 'react';
import { apiFetch } from "../lib/api";
import { format, addDays, isWithinInterval, parse, formatDistanceToNow, isBefore, isAfter, addMinutes } from 'date-fns';
import { ar, fr } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Settings,
  Video,
  FileText,
  Search,
} from 'lucide-react';
import { Appointment } from '../types';
import { AvailabilityManager } from '../components/AvailabilityManager';
import { AppointmentHistoryModal } from '../components/AppointmentHistoryModal';
import { TeleconsultationModal } from '../components/TeleconsultationModal';
import { PatientRecordModal } from '../components/PatientRecordModal';
import { PatientSearchModal } from '../components/PatientSearchModal';
import { useAuthStore } from '../store/auth';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface ExtendedAppointment extends Appointment {
  teleconsultation?: { jitsiUrl: string; status: string };
  createdAt?: string;
  cancellationReason?: string | null;
  isFollowUp?: boolean;
  cancelledAt?: string | null;
}

interface OperationalOverview {
  pendingCount: number;
  pendingAppointments: ExtendedAppointment[];
  recentCancellationCount: number;
  recentCancellations: ExtendedAppointment[];
  incompleteCount: number;
  incompleteAppointments: ExtendedAppointment[];
}

export function DoctorDashboard() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const doctorId = user?.data?.id;
  const [appointments, setAppointments] = useState<ExtendedAppointment[]>([]);
  const [followUpAppointments, setFollowUpAppointments] = useState<ExtendedAppointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<ExtendedAppointment[]>([]);
  const [historicAppointments, setHistoricAppointments] = useState<ExtendedAppointment[]>([]);
  const [availability, setAvailability] = useState<{ [date: string]: string[] }>({});
  const [availableSlotsIn14Days, setAvailableSlotsIn14Days] = useState(0);
  const [operationalOverview, setOperationalOverview] = useState<OperationalOverview>({ pendingCount: 0, pendingAppointments: [], recentCancellationCount: 0, recentCancellations: [], incompleteCount: 0, incompleteAppointments: [] });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTeleconsultationModalOpen, setIsTeleconsultationModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ExtendedAppointment | null>(null);
  const [patientRecordAppointment, setPatientRecordAppointment] = useState<ExtendedAppointment | null>(null);
  const [appointmentToRefuse, setAppointmentToRefuse] = useState<ExtendedAppointment | null>(null);
  const [refusalReason, setRefusalReason] = useState('');
  const [isPatientSearchOpen, setIsPatientSearchOpen] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'pending'>('all');
  // State for timers
  const [timers, setTimers] = useState<{ [key: string]: string | null }>({});

  if (location.pathname === '/doctor/statistics') {
    
  }

  const fetchAppointments = async () => {
    try {
      const doctorId = user?.data?.id;
      

      if (!doctorId) {
        throw new Error(t('errorDoctorIdNotFound'));
      }

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + (7 - startOfWeek.getDay()));

      const response = await apiFetch(
        `http://localhost:3000/api/appointments/doctor/${doctorId}`,
        {
          headers: {
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        
        throw new Error(t('errorFetchAppointments'));
      }

      const data = await response.json();
      

      if (!Array.isArray(data.appointments)) {
        throw new Error(t('errorUnexpectedResponse'));
      }

      const upcomingAppointments = data.appointments.filter((apt: ExtendedAppointment) => {
        const aptDate = new Date(apt.date);
        return !apt.isFollowUp && ['pending', 'accepted'].includes(apt.status)
          && isWithinInterval(aptDate, { start: startOfWeek, end: endOfWeek });
      });
      setFollowUpAppointments(data.appointments.filter((apt: ExtendedAppointment) =>
        apt.isFollowUp && apt.status === 'accepted' && new Date(apt.date) >= new Date(new Date().setHours(0, 0, 0, 0))
      ));

      const historicFiltered = data.appointments.filter(
        (apt: ExtendedAppointment) => apt.status === 'completed' || apt.status === 'cancelled'
      );

      setAllAppointments(data.appointments);
      setAppointments(upcomingAppointments);
      setHistoricAppointments(historicFiltered);
    } catch (error) {
      
      toast.error(t('errorLoadAppointments'));
      setAppointments([]);
      setFollowUpAppointments([]);
      setAllAppointments([]);
      setHistoricAppointments([]);
    }
  };

  const fetchAvailability = async () => {
    try {
      const doctorId = user?.data?.id;

      if (!doctorId) {
        throw new Error(t('errorDoctorIdNotFound'));
      }

      const response = await apiFetch(
        `http://localhost:3000/api/users/get-availability?userId=${doctorId}`,
        {
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        
        throw new Error(t('errorFetchAvailability'));
      }

      const data = await response.json();
      

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

    } catch (error) {
      
      toast.error(t('errorLoadAvailability'));
      setAvailability({});
    }
  };

  const fetchOperationalOverview = async () => {
    try {
      const doctorId = user?.data?.id;
      if (!doctorId) return;
      const response = await apiFetch(`http://localhost:3000/api/appointments/doctor/${doctorId}/operational-overview`);
      if (!response.ok) throw new Error('operational overview request failed');
      const data = await response.json();
      setOperationalOverview({
        pendingCount: Number(data.pendingCount) || 0,
        pendingAppointments: Array.isArray(data.pendingAppointments) ? data.pendingAppointments : [],
        recentCancellationCount: Number(data.recentCancellationCount) || 0,
        recentCancellations: Array.isArray(data.recentCancellations) ? data.recentCancellations : [],
        incompleteCount: Number(data.incompleteCount) || 0,
        incompleteAppointments: Array.isArray(data.incompleteAppointments) ? data.incompleteAppointments : [],
      });
    } catch {
      setOperationalOverview({ pendingCount: 0, pendingAppointments: [], recentCancellationCount: 0, recentCancellations: [], incompleteCount: 0, incompleteAppointments: [] });
    }
  };

  useEffect(() => {
    const occupiedSlots = new Set(allAppointments
      .filter((item) => ['pending', 'accepted'].includes(item.status))
      .map((item) => `${format(new Date(item.date), 'yyyy-MM-dd')}T${item.time}`));
    const now = new Date();
    const lastDay = addDays(now, 14);
    const todayKey = format(now, 'yyyy-MM-dd');
    const currentTime = format(now, 'HH:mm');
    const freeSlotCount = Object.entries(availability).reduce((count, [date, times]) => {
      if (date < todayKey || date > format(lastDay, 'yyyy-MM-dd')) return count;
      return count + times.filter((time) => (date !== todayKey || time > currentTime) && !occupiedSlots.has(`${date}T${time}`)).length;
    }, 0);
    setAvailableSlotsIn14Days(freeSlotCount);
  }, [availability, allAppointments]);

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: 'accepted' | 'cancelled',
    reason?: string
  ) => {
    if (status === 'cancelled' && (reason?.trim().length || 0) < 5) {
      toast.error(t('refusalReasonMinimum'));
      return;
    }
    try {
      const action = status === 'accepted' ? 'accept' : 'cancel';
      const response = await apiFetch(
        `http://localhost:3000/api/appointments/${appointmentId}/${action}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: status === 'cancelled' ? JSON.stringify({ reason: reason?.trim() }) : undefined,
        }
      );

      const responseBody = await response.text();
      let data: { error?: string; appointment?: ExtendedAppointment } | null = null;
      try {
        data = responseBody ? JSON.parse(responseBody) : null;
      } catch {
        if (response.ok) {
          throw new Error(t('errorUpdateAppointment'));
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || `${response.status} ${response.statusText}`);
      }

      if (!data?.appointment) {
        throw new Error(t('errorUpdateAppointment'));
      }
      const updatedAppointment = data.appointment;

      setAllAppointments((prevAppointments) => prevAppointments.map((apt) =>
        apt._id === appointmentId ? updatedAppointment : apt
      ));

      setAppointments((prevAppointments) =>
        prevAppointments.map((apt) =>
          apt._id === appointmentId ? updatedAppointment : apt
        )
      );

      if (status === 'cancelled') {
        const cancelledAppointment = appointments.find(
          (apt) => apt._id === appointmentId
        );
        if (cancelledAppointment) {
          setHistoricAppointments((prevHistoricAppointments) => [
            ...prevHistoricAppointments.filter((item) => item._id !== appointmentId),
            updatedAppointment,
          ]);
          setAppointments((prevAppointments) =>
            prevAppointments.filter((apt) => apt._id !== appointmentId)
          );
        }
        setAppointmentToRefuse(null);
        setRefusalReason('');
      }

      toast.success(t(status === 'accepted' ? 'appointmentAccepted' : appointmentToRefuse ? 'appointmentRefused' : 'appointmentCancelled'));
      void fetchOperationalOverview();
    } catch (error) {
      
      toast.error(t('errorTryAgain'));
    }
  };

  const updateRequiresConfirmation = async () => {
    try {
      if (!isAuthenticated) {
        toast.error(t('errorPleaseLogin'));
        return;
      }

      const newValue = !requiresConfirmation;
      const formData = new FormData();
      formData.append('requiresConfirmation', String(newValue));
      const response = await apiFetch('http://localhost:3000/api/users/profile', {
        method: 'PUT',
        headers: {
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setRequiresConfirmation(newValue);
        toast.success(t('confirmationPreferenceUpdated'));
      } else {
        throw new Error(data.error || t('errorUpdate'));
      }
    } catch (error) {
      
      toast.error(t('errorServerUpdate'));
    }
  };

  const completeAppointment = async (appointmentId: string) => {
    try {
      const response = await apiFetch(
        `http://localhost:3000/api/appointments/${appointmentId}/complete`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('errorCompleteAppointment'));
      }

      const updatedAppointment = await response.json();
      setAllAppointments((prevAppointments) => prevAppointments.map((apt) =>
        apt._id === appointmentId ? updatedAppointment.appointment : apt
      ));
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
      void fetchOperationalOverview();
    } catch (error) {
      
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
    return appointment.status === "accepted";
  };

  const displayedAppointments = appointments.filter((appointment) =>
    appointmentFilter === 'pending' ? appointment.status === 'pending' : true
  );

  useEffect(() => {
    if (!doctorId || !isAuthenticated) return;
    fetchAppointments();
    fetchAvailability();
    fetchOperationalOverview();

    const intervalId = window.setInterval(fetchAppointments, 5000);
    const overviewIntervalId = window.setInterval(fetchOperationalOverview, 5000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchAppointments();
        void fetchAvailability();
        void fetchOperationalOverview();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(overviewIntervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [doctorId, isAuthenticated]);

  return (
    <div className={`min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8 ${i18n.language === 'ar' ? 'text-right' : 'text-left'}`} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-col gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-700 to-violet-600 p-6 text-white shadow-xl shadow-indigo-900/10 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden rounded-2xl bg-white/15 p-3 ring-1 ring-white/20 sm:block"><Calendar className="h-7 w-7" /></div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">{t('upcomingAppointments')}</p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('doctorDashboard')}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setIsPatientSearchOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-indigo-800 shadow-sm transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <Search className="w-4 h-4" />
              Rechercher une fiche patient
            </button>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <CalendarIcon className="w-5 h-5" />
                {t('weeklyAppointments')}
              </h2>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{appointments.length}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('scheduledAppointments')}</p>
            </div>

            <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <CheckCircle className="w-5 h-5 dark:text-indigo-400 text-green-600" />
                {t('completedConsultations')}
              </h2>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {historicAppointments.filter((apt) => apt.status === 'completed').length}
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('thisWeek')}</p>
            </div>

            <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <Calendar className="w-5 h-5 dark:text-indigo-400 text-blue-600" />
                {t('availableSlots')}
              </h2>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {availableSlotsIn14Days}
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('next14Days')}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200"><Clock className="h-5 w-5" />{t('pendingRequests')}</h2>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{operationalOverview.pendingCount}</div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('awaitingYourDecision')}</p>
            </div>
            <div className={`rounded-2xl border p-5 shadow-sm ${operationalOverview.incompleteCount ? 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><FileText className="h-5 w-5 text-orange-600" />{t('consultationsToComplete')}</h2>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{operationalOverview.incompleteCount}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('completedWithoutRecord')}</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm dark:border-violet-900 dark:bg-violet-950/30">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200"><XCircle className="h-5 w-5" />{t('recentCancellations')}</h2>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{operationalOverview.recentCancellationCount}</div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('last7Days')}</p>
            </div>
        </div>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/70 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Clock className="h-5 w-5 text-amber-600" />{t('pendingRequests')}</h2>
            {operationalOverview.pendingAppointments.length ? <div className="space-y-3">
              {operationalOverview.pendingAppointments.slice(0, 4).map((item) => <article key={item._id} className="rounded-xl bg-amber-50/70 p-3 dark:bg-amber-950/20">
                <p className="font-medium text-slate-900 dark:text-white">{item.patientId?.firstName || t('nameNotAvailable')} {item.patientId?.lastName || ''}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{format(new Date(item.date), 'dd/MM/yyyy')} · {item.time}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void updateAppointmentStatus(item._id, 'accepted')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">{t('accept')}</button>
                  <button type="button" onClick={() => setAppointmentToRefuse(item)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30">{t('refuseAppointment')}</button>
                </div>
              </article>)}
              {operationalOverview.pendingCount > 4 && <p className="text-xs text-slate-500">{t('moreRequestsWaiting', { count: operationalOverview.pendingCount - 4 })}</p>}
            </div> : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500 dark:border-slate-700">{t('noPendingRequests')}</p>}
          </div>

          <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm dark:border-orange-900/70 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><FileText className="h-5 w-5 text-orange-600" />{t('consultationsToComplete')}</h2>
            {operationalOverview.incompleteAppointments.length ? <div className="space-y-3">
              {operationalOverview.incompleteAppointments.slice(0, 4).map((item) => <article key={item._id} className="flex items-center justify-between gap-3 rounded-xl bg-orange-50/70 p-3 dark:bg-orange-950/20">
                <div className="min-w-0"><p className="truncate font-medium text-slate-900 dark:text-white">{item.patientId?.firstName || t('nameNotAvailable')} {item.patientId?.lastName || ''}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{format(new Date(item.date), 'dd/MM/yyyy')} · {item.time}</p></div>
                <button type="button" disabled={!item.patientId?._id} onClick={() => setPatientRecordAppointment(item)} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{t('completeDetails')}</button>
              </article>)}
              {operationalOverview.incompleteCount > 4 && <p className="text-xs text-slate-500">{t('moreIncompleteConsultations', { count: operationalOverview.incompleteCount - 4 })}</p>}
            </div> : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500 dark:border-slate-700">{t('noIncompleteConsultations')}</p>}
          </div>

          <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900/70 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><XCircle className="h-5 w-5 text-violet-600" />{t('recentCancellations')}</h2>
            {operationalOverview.recentCancellations.length ? <div className="space-y-3">
              {operationalOverview.recentCancellations.slice(0, 4).map((item) => <article key={item._id} className="rounded-xl bg-violet-50/70 p-3 dark:bg-violet-950/20">
                <div className="flex items-start justify-between gap-2"><p className="font-medium text-slate-900 dark:text-white">{item.patientId?.firstName || t('nameNotAvailable')} {item.patientId?.lastName || ''}</p><span className="shrink-0 text-xs text-slate-500">{item.cancelledAt ? format(new Date(item.cancelledAt), 'dd/MM HH:mm') : ''}</span></div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{format(new Date(item.date), 'dd/MM/yyyy')} · {item.time}</p>
                {item.cancellationReason && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.cancellationReason}</p>}
              </article>)}
            </div> : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500 dark:border-slate-700">{t('noRecentCancellations')}</p>}
          </div>
        </section>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Settings className="w-5 h-5 text-indigo-600" />
            {t('bookingSettings')}
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresConfirmation}
                onChange={updateRequiresConfirmation}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              {t('requireManualConfirmation')}
            </label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {requiresConfirmation
                ? t('manualConfirmationRequired')
                : t('autoAcceptAppointments')}
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div>
            {followUpAppointments.length > 0 && (
              <section className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
                <h2 className="mb-4 text-lg font-semibold text-indigo-950 dark:text-indigo-100">{t('followUpAppointments')}</h2>
                <div className="space-y-3">
                  {[...followUpAppointments].sort((a, b) => {
                    const dateA = new Date(`${format(new Date(a.date), 'yyyy-MM-dd')}T${a.time}`);
                    const dateB = new Date(`${format(new Date(b.date), 'yyyy-MM-dd')}T${b.time}`);
                    return dateA.getTime() - dateB.getTime();
                  }).map((followUp) => (
                    <article key={followUp._id} className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm dark:border-indigo-900/60 dark:bg-slate-900">
                      <p className="font-semibold text-slate-900 dark:text-white">{followUp.patientId?.firstName || t('nameNotAvailable')} {followUp.patientId?.lastName || ''}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{format(new Date(followUp.date), 'PPP', { locale: i18n.language === 'fr' ? fr : undefined })} · {followUp.time}</p>
                      <span className="mt-2 inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">{t('followUpAppointment')}</span>
                      <button type="button" onClick={() => setPatientRecordAppointment(followUp)} className="ml-3 text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300">{t('openPatientRecord')}</button>
                      <button type="button" onClick={() => completeAppointment(followUp._id)} className="ml-3 text-sm font-medium text-green-700 hover:underline dark:text-green-300">{t('complete')}</button>
                    </article>
                  ))}
                </div>
              </section>
            )}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t('upcomingAppointments')}</h2>
              <div className="flex gap-2" role="group" aria-label={t('filterAppointments')}>
                <button
                  type="button"
                  onClick={() => setAppointmentFilter('all')}
                  aria-pressed={appointmentFilter === 'all'}
                  className={clsx('rounded-full px-3 py-1.5 text-sm font-medium', appointmentFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200')}
                >
                  {t('all')} ({appointments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentFilter('pending')}
                  aria-pressed={appointmentFilter === 'pending'}
                  className={clsx('rounded-full px-3 py-1.5 text-sm font-medium', appointmentFilter === 'pending' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200')}
                >
                  {t('pending')} ({appointments.filter((appointment) => appointment.status === 'pending').length})
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {displayedAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  <Calendar className="mx-auto mb-3 h-9 w-9 text-slate-400" />
                  <p>{t('noAppointmentsThisWeek')}</p>
                </div>
              ) : (
                [...displayedAppointments]
                  .sort((a, b) => {
                    const dateA = new Date(`${format(new Date(a.date), 'yyyy-MM-dd')}T${a.time}`);
                    const dateB = new Date(`${format(new Date(b.date), 'yyyy-MM-dd')}T${b.time}`);
                    return dateB.getTime() - dateA.getTime();
                  })
                  .map((appointment) => (
                    <div
                      key={appointment._id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:p-5"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {t('patient')}:{' '}
                            {appointment.patientId?.firstName || t('nameNotAvailable')}{' '}
                            {appointment.patientId?.lastName || t('nameNotAvailable')}
                          </h3>
                          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Clock className="w-4 h-4" />
                            {format(new Date(appointment.date), 'PPP', {
                              locale: i18n.language === 'fr' ? fr : undefined,
                            })}{' '}
                            {t('at')} {appointment.time}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{appointment.symptoms}</p>
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
                          {appointment.status === 'pending' && appointment.createdAt && (
                            <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                              {t('pendingSince', {
                                time: formatDistanceToNow(new Date(appointment.createdAt), {
                                  locale: i18n.language === 'fr' ? fr : i18n.language === 'ar' ? ar : undefined,
                                }),
                              })}
                            </p>
                          )}
                          {appointment.isTeleconsultation && appointment.status === "accepted" && (
                            <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                              {timers[appointment._id] || t('consultationEnded')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          {['accepted', 'completed'].includes(appointment.status) && (appointment.patientId as any)?._id && (
                            <button
                              onClick={() => setPatientRecordAppointment(appointment)}
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                              title={t('openPatientRecord')}
                            >
                              <FileText className="w-4 h-4" />
                              Fiche patient
                            </button>
                          )}
                          {appointment.status === 'pending' && (
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, 'accepted')}
                              className="rounded-xl p-2 text-green-700 transition hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950/40"
                              title={t('accept')}
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                          {appointment.status === 'pending' && (
                            <button
                              onClick={() => setAppointmentToRefuse(appointment)}
                              className="rounded-xl p-2 text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                              title={t('refuseAppointment')}
                              aria-label={t('refuseAppointment')}
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          )}
                          {appointment.isTeleconsultation && appointment.status === "accepted" && (
                            <>
                              <button
                                onClick={() => openTeleconsultation(appointment)}
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
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
                          {appointment.status === "accepted" && (
                            <button
                              onClick={() => completeAppointment(appointment._id)}
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
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
              className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('history')}
            </button>
          </div>

          <div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <AvailabilityManager onUpdateAvailability={setAvailability} appointments={allAppointments} />
            </div>
          </div>
        </div>
      </div>

      <AppointmentHistoryModal
        isOpen={isModalOpen}
        onClose={closeHistoricModal}
        appointments={historicAppointments}
      />
      {appointmentToRefuse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4" role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800" role="dialog" aria-modal="true" aria-labelledby="refuse-appointment-title">
            <h2 id="refuse-appointment-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('refuseThisRequest')}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t('patientWillReceiveRefusalReason')}
            </p>
            <label htmlFor="doctor-refusal-reason" className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('refusalReasonRequired')}
            </label>
            <textarea
              id="doctor-refusal-reason"
              value={refusalReason}
              onChange={(event) => setRefusalReason(event.target.value)}
              maxLength={500}
              rows={3}
              required
              placeholder={t('refusalReasonPlaceholder')}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setAppointmentToRefuse(null); setRefusalReason(''); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t('keepRequest')}
              </button>
              <button
                type="button"
                disabled={refusalReason.trim().length < 5}
                onClick={() => updateAppointmentStatus(appointmentToRefuse._id, 'cancelled', refusalReason)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
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
      {patientRecordAppointment && (
        <PatientRecordModal
          isOpen={Boolean(patientRecordAppointment)}
          onClose={() => setPatientRecordAppointment(null)}
          patientId={(patientRecordAppointment.patientId as any)._id}
          patientName={`${(patientRecordAppointment.patientId as any).firstName || ''} ${(patientRecordAppointment.patientId as any).lastName || ''}`.trim() || 'Patient'}
          appointment={patientRecordAppointment}
          onSaved={() => { void fetchOperationalOverview(); }}
        />
      )}
      <PatientSearchModal
        isOpen={isPatientSearchOpen}
        onClose={() => setIsPatientSearchOpen(false)}
        appointments={allAppointments as any}
        onSelectPatient={(patient) => {
          setIsPatientSearchOpen(false);
          setPatientRecordAppointment(patient.appointment as ExtendedAppointment);
        }}
      />
    </div>
  );
}
