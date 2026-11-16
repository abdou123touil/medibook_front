import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { Calendar, DollarSign, CheckCircle, Clock, Video, Download, FileSpreadsheet, Plus, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DateRange } from "react-date-range";
import { addDays, format, formatDistanceToNow, parse, isBefore, isAfter, addMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import Papa from "papaparse";
import jsPDF from "jspdf";
import { motion } from "framer-motion";
import { AppointmentHistoryModal } from "../components/AppointmentHistoryModal";
import { TeleconsultationModal } from "../components/TeleconsultationModal";
import { MedicalHistory } from "../components/MedicalHistory";
import { Prescriptions } from "../components/Prescriptions";
import toast from "react-hot-toast";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { normalizePrescription } from "../lib/prescriptions";

interface Stat {
  date: string;
  appointments: number;
  expenses: number;
}

interface StatusDistribution {
  name: string;
  value: number;
}

interface StatsResponse {
  message: string;
  stats: Stat[];
  totalAppointments: number;
  totalExpenses: number;
  upcomingAppointments: number;
  completionRate: number;
  statusDistribution: StatusDistribution[];
}

interface Appointment {
  _id: string;
  date: string;
  time: string;
  status: string;
  isTeleconsultation: boolean;
  isFollowUp?: boolean;
  followUpOfAppointmentId?: string | null;
  teleconsultation?: { jitsiUrl: string; status: string };
  doctorId: { _id?: string; firstName: string; lastName: string; speciality: string };
  cancellationReason?: string | null;
  cancelledBy?: 'client' | 'doctor' | 'system' | null;
}

interface PatientClinicalRecord {
  doctorId: { _id?: string; firstName: string; lastName: string; speciality?: string } | null;
  allergies?: string;
  medicalHistory?: string;
  currentMedications?: string;
  updatedAt?: string;
  consultations: Array<{
    appointmentId: string;
    consultationDate: string;
    symptoms: string;
    diagnosis: string;
    treatment: string;
    prescriptions: Array<string | {
      name: string; dosage?: string; route?: string; frequency?: string;
      duration?: string; quantity?: string; instructions?: string;
    }>;
    notes: string;
    followUpAt?: string | null;
    followUpAppointmentId?: string | null;
  }>;
}

const STATUS_COLORS: { [key: string]: string } = {
  cancelled: "#ef4444",
  completed: "#10b981",
  accepted: "#3b82f6",
  pending: "#f59e0b",
};

const PatientDashboard = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stat[]>([]);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [timeRange, setTimeRange] = useState("month");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState([
    {
      startDate: addDays(new Date(), -30),
      endDate: new Date(),
      key: "selection",
    },
  ]);
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientRecords, setPatientRecords] = useState<PatientClinicalRecord[]>([]);
  const [isTeleconsultationModalOpen, setIsTeleconsultationModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancellingAppointment, setIsCancellingAppointment] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const userId = user?.data?.id || null;

  // State for timers
  const [timers, setTimers] = useState<{ [key: string]: string | null }>({});

  const cancelAppointment = async () => {
    if (!appointmentToCancel || isCancellingAppointment) return;
    if (cancellationReason.trim().length < 5) {
      toast.error(t('cancellationReasonMinimum'));
      return;
    }
    setIsCancellingAppointment(true);
    try {
      const response = await apiFetch(`http://localhost:3000/api/appointments/${appointmentToCancel._id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancellationReason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('cancelAppointmentError'));
      setAppointments((items) => items.map((item) => item._id === appointmentToCancel._id
        ? { ...item, status: 'cancelled', cancellationReason: cancellationReason.trim(), cancelledBy: 'client' }
        : item));
      setAppointmentToCancel(null);
      setCancellationReason('');
      toast.success(t('appointmentCancelledWaitlist'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('cancelAppointmentError'));
    } finally {
      setIsCancellingAppointment(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) {
        
        setError(t("errorNotLoggedIn"));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          timeRange,
          statusFilter,
          ...(isCustomDate && {
            startDate: dateRange[0].startDate.toISOString(),
            endDate: dateRange[0].endDate.toISOString(),
          }),
        });
        const response = await apiFetch(
          `http://localhost:3000/api/appointments/patient/${userId}/stats?${params}`,
          {
            headers: {
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("errorFetch"));
        }

        const data: StatsResponse = await response.json();
        setStats(data.stats || []);
        const rawTotalAppointments = (data as unknown as { totalAppointments: number | Array<{ count?: number }> }).totalAppointments;
        const totalAppointmentCount = typeof rawTotalAppointments === 'number'
          ? rawTotalAppointments
          : Number(rawTotalAppointments?.[0]?.count || 0);
        setTotalAppointments(Number.isFinite(totalAppointmentCount) ? totalAppointmentCount : 0);
        setTotalExpenses(data.totalExpenses || 0);
        setUpcomingAppointments(data.upcomingAppointments || 0);
        setCompletionRate(data.completionRate || 0);
        setStatusDistribution(data.statusDistribution || []);
        setLoading(false);
      } catch (err: any) {
        
        setError(err.message || t("errorFetch"));
        setLoading(false);
      }
    };

    const fetchAppointments = async () => {
      try {
        const response = await apiFetch(
          `http://localhost:3000/api/appointments/patient/${userId}`,
          {
            headers: {
            },
          }
        );
        if (!response.ok) {
          throw new Error(t("errorFetchAppointments"));
        }
        const data = await response.json();
         // Debug log
        setAppointments(data.appointments || []);
      } catch (err) {
        
        toast.error(t("errorFetchAppointments"));
      }
    };

    const fetchPatientRecords = async () => {
      try {
        const response = await apiFetch('http://localhost:3000/api/patients/me/records', {
        });
        if (!response.ok) throw new Error('Impossible de charger votre historique médical.');
        const data = await response.json();
        setPatientRecords(data.records || []);
      } catch (err) {
        
      }
    };

    if (userId) {
      fetchStats();
      fetchAppointments();
      fetchPatientRecords();
    }
    const appointmentsRefreshId = userId ? window.setInterval(fetchAppointments, 5000) : undefined;
    return () => { if (appointmentsRefreshId) window.clearInterval(appointmentsRefreshId); };
  }, [userId, timeRange, statusFilter, dateRange, isCustomDate, t]);

  const medicalHistoryRecords = patientRecords.flatMap((record) => {
    const doctor = `Dr. ${record.doctorId?.firstName || ''} ${record.doctorId?.lastName || ''}`.trim();
    const profileEntry = (record.allergies || record.medicalHistory || record.currentMedications) ? [{
      id: `record-${record.doctorId?._id || doctor}`,
      date: record.updatedAt ? format(new Date(record.updatedAt), 'dd/MM/yyyy') : '',
      type: 'consultation' as const,
      doctor,
      description: [
        record.allergies && `Allergies : ${record.allergies}`,
        record.medicalHistory && `Antécédents : ${record.medicalHistory}`,
        record.currentMedications && `Traitements actuels : ${record.currentMedications}`,
      ].filter(Boolean).join('\n'),
    }] : [];
    const visits = (record.consultations || []).map((consultation) => ({
      id: String(consultation.appointmentId),
      date: format(new Date(consultation.consultationDate), 'dd/MM/yyyy'),
      type: 'consultation' as const,
      doctor,
      followUpAt: consultation.followUpAppointmentId || appointments.some((item) =>
        item.isFollowUp && item.status === 'accepted' && item.followUpOfAppointmentId === String(consultation.appointmentId)
      ) ? undefined : consultation.followUpAt || undefined,
      description: [
        consultation.symptoms && `Motif : ${consultation.symptoms}`,
        consultation.diagnosis && `Diagnostic : ${consultation.diagnosis}`,
        consultation.treatment && `Recommandations : ${consultation.treatment}`,
        consultation.notes,
      ].filter(Boolean).join('\n'),
    }));
    return [...profileEntry, ...visits];
  });

  const prescriptionRecords = patientRecords.flatMap((record) =>
    (record.consultations || [])
      .flatMap((consultation) => {
        const medications = (consultation.prescriptions || []).map(normalizePrescription).filter((item) => item.name);
        return medications.length ? [{
          id: String(consultation.appointmentId),
          date: format(new Date(consultation.consultationDate), 'dd/MM/yyyy'),
          doctor: `${record.doctorId?.firstName || ''} ${record.doctorId?.lastName || ''}`.trim(),
          medications,
          notes: consultation.treatment || consultation.notes,
        }] : [];
      })
  );

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

  const handleExportCSV = () => {
    const csvData = stats.map((stat) => ({
      [t("date")]: stat.date,
      [t("totalAppointments")]: stat.appointments,
      [t("totalExpenses")]: `${stat.expenses} DT`,
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "patient_stats.csv";
    link.click();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(t("dashboardTitle"), 20, 20);
    doc.setFontSize(12);
    doc.text(`${t("totalAppointments")}: ${totalAppointments}`, 20, 40);
    doc.text(`${t("totalExpenses")}: ${totalExpenses} DT`, 20, 50);
    doc.text(`${t("upcomingAppointments")}: ${upcomingAppointments}`, 20, 60);
    doc.text(`${t("completionRate")}: ${completionRate}%`, 20, 70);
    doc.save("patient_stats.pdf");
  };

  const openTeleconsultation = (appointment: Appointment) => {
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

  const statCards = [
    {
      title: t("totalAppointments"),
      value: totalAppointments,
      icon: <Calendar className="w-6 h-6 text-emerald-500" />,
    },
    {
      title: t("totalExpenses"),
      value: `${totalExpenses} DT`,
      icon: <DollarSign className="w-6 h-6 text-emerald-500" />,
    },
    {
      title: t("upcomingAppointments"),
      value: upcomingAppointments,
      icon: <Clock className="w-6 h-6 text-emerald-500" />,
    },
    {
      title: t("completionRate"),
      value: `${completionRate}%`,
      icon: <CheckCircle className="w-6 h-6 text-emerald-500" />,
    },
  ];

  return (
    <div
      className={`min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8 ${
        i18n.language === "ar" ? "text-right" : "text-left"
      }`}
      dir={i18n.language === "ar" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-600 p-6 text-white shadow-xl shadow-emerald-900/10 sm:p-8 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-start gap-4">
          <div className="hidden rounded-2xl bg-white/15 p-3 ring-1 ring-white/20 sm:block"><Activity className="h-7 w-7" /></div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">{t('statistics')}</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('dashboardTitle')}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t("exportCSV")}
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <Download className="h-4 w-4" />
            {t("exportPDF")}
          </button>
          <button
            onClick={() => navigate('/client')}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <Plus className="h-4 w-4" />
            {t("bookAppointment")}
          </button>
        </div>
      </motion.header>

      {/* Filtres */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("period")}
            </label>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                setIsCustomDate(e.target.value === "custom");
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="day">{t("last7Days")}</option>
              <option value="week">{t("lastWeek")}</option>
              <option value="month">{t("lastMonth")}</option>
              <option value="quarter">{t("lastQuarter")}</option>
              <option value="year">{t("lastYear")}</option>
              <option value="custom">{t("custom")}</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("status")}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t("all")}</option>
              <option value="pending">{t("pending")}</option>
              <option value="accepted">{t("accepted")}</option>
              <option value="completed">{t("completed")}</option>
              <option value="cancelled">{t("cancelled")}</option>
            </select>
          </div>
        </div>
        {isCustomDate && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <DateRange
              editableDateInputs
              months={1}
              onChange={(item) => setDateRange([item.selection])}
              moveRangeOnFirstSelection={false}
              ranges={dateRange}
              className="w-full"
              direction="horizontal"
            />
          </div>
        )}
      </motion.div>

      {/* Métriques */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700"></div>
              <div className="h-8 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : stats.length === 0 && totalAppointments === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
          <Calendar className="mx-auto mb-4 h-10 w-10 text-slate-400" />
          <p className="mx-auto max-w-md text-slate-600 dark:text-slate-300">{t("noAppointments")}</p>
          <button type="button" onClick={() => navigate('/client')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
            <Plus className="h-4 w-4" />{t('bookAppointment')}
          </button>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {statCards.map((card, index) => (
              <div
                key={index}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {card.title}
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                      {card.value}
                    </p>
                  </div>
                  <span className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:ring-emerald-900">{card.icon}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Upcoming Appointments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.18 }}
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("upcomingAppointments")}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('totalAppointments')}: {appointments.filter((apt) => ['pending', 'accepted'].includes(apt.status)).length}</p>
              </div>
              <button type="button" onClick={() => setIsHistoryModalOpen(true)} className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50">{t('viewHistory')} →</button>
            </div>
            {appointments.filter((apt) => ['pending', 'accepted'].includes(apt.status)).length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-4 py-8 text-center dark:bg-slate-800/70">
                <Calendar className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-600 dark:text-slate-300">{t("noAppointments")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments
                  .filter((apt) => ["pending", "accepted"].includes(apt.status))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((appointment) => (
                    <article
                      key={appointment._id}
                      className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                          <span className="text-lg font-bold leading-none">{format(new Date(appointment.date), 'dd')}</span>
                          <span className="mt-1 text-[10px] font-semibold uppercase">{format(new Date(appointment.date), 'MMM')}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">Dr. {appointment.doctorId.lastName} <span className="font-normal text-slate-500">· {appointment.doctorId.speciality}</span></p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"><Clock className="h-4 w-4" />{format(new Date(appointment.date), 'dd/MM/yyyy')} · {appointment.time}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${appointment.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200'}`}>{t(appointment.status)}</span>
                            {appointment.isFollowUp && <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">{t('followUpAppointment')}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {appointment.isTeleconsultation && appointment.status === "accepted" && (
                          <p className="text-sm text-indigo-600 dark:text-indigo-400">
                            {timers[appointment._id] || t("consultationEnded")}
                          </p>
                        )}
                        {appointment.isTeleconsultation && appointment.status === "accepted" && (
                          <button
                            onClick={() => openTeleconsultation(appointment)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                            disabled={!appointment.teleconsultation?.jitsiUrl}
                          >
                            <Video className="w-5 h-5" />
                            {t("joinTeleconsultation")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setAppointmentToCancel(appointment)}
                          className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                        >
                          {t('cancelAppointment')}
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </motion.div>

          {appointments.some((apt) => ['completed', 'cancelled'].includes(apt.status)) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
            >
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
                {t('appointmentHistory')}
              </h2>
              <div className="space-y-3">
                {appointments
                  .filter((apt) => ['completed', 'cancelled'].includes(apt.status))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((appointment) => (
                    <div key={appointment._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Dr. {appointment.doctorId.lastName} · {format(new Date(appointment.date), 'dd/MM/yyyy')} à {appointment.time}
                        </p>
                        {appointment.cancellationReason && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Raison : {appointment.cancellationReason}</p>
                        )}
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-sm font-medium"
                        style={{
                          color: STATUS_COLORS[appointment.status],
                          backgroundColor: `${STATUS_COLORS[appointment.status]}1A`,
                        }}
                      >
                        {t(appointment.status)}
                      </span>
                      {appointment.status === 'cancelled' && appointment.doctorId._id && (
                        <button
                          type="button"
                          onClick={() => navigate('/client', { state: { rebookDoctorId: appointment.doctorId._id } })}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Reprogrammer
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* Graphiques */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
                {t("appointmentEvolution")}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="appointments" fill="#10b981" name={t("totalAppointments")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
                {t("statusDistribution")}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    label
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.name] || "#6b7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, t(name)]} contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  <Legend formatter={(value) => t(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </>
      )}

      <div className="mt-6 grid gap-5 dark:text-gray-100 lg:grid-cols-2">
        <MedicalHistory records={medicalHistoryRecords} />
        <Prescriptions prescriptions={prescriptionRecords} />
      </div>

      <AppointmentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        appointments={appointments}
      />
      {appointmentToCancel && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isCancellingAppointment) {
              setAppointmentToCancel(null);
              setCancellationReason('');
            }
          }}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-appointment-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
          >
            <h2 id="cancel-appointment-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('cancelThisAppointment')}
            </h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              {t('appointmentWithDoctorOn', { doctor: appointmentToCancel.doctorId.lastName, date: format(new Date(appointmentToCancel.date), 'dd/MM/yyyy'), time: appointmentToCancel.time })}
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t('cancellationIsFinal')}
            </p>
            <label htmlFor="patient-cancellation-reason" className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('cancellationReasonRequired')}
            </label>
            <textarea
              id="patient-cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('cancellationReasonPlaceholder')}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isCancellingAppointment}
                onClick={() => { setAppointmentToCancel(null); setCancellationReason(''); }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('keepAppointment')}
              </button>
              <button
                type="button"
                disabled={isCancellingAppointment || cancellationReason.trim().length < 5}
                onClick={cancelAppointment}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancellingAppointment ? 'Annulation…' : 'Confirmer l’annulation'}
              </button>
            </div>
          </motion.div>
        </motion.div>
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
      </div>
    </div>
  );
};

export default PatientDashboard;
