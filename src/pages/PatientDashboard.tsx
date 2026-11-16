import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { Calendar, DollarSign, CheckCircle, Clock, Video } from "lucide-react";
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
    prescriptions: string[];
    notes: string;
    followUpAt?: string | null;
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
      followUpAt: consultation.followUpAt || undefined,
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
      .filter((consultation) => consultation.prescriptions?.length)
      .map((consultation) => ({
        id: String(consultation.appointmentId),
        date: format(new Date(consultation.consultationDate), 'dd/MM/yyyy'),
        doctor: `${record.doctorId?.firstName || ''} ${record.doctorId?.lastName || ''}`.trim(),
        medications: consultation.prescriptions.map((name) => ({ name, dosage: '', frequency: '', duration: '' })),
        notes: consultation.treatment || consultation.notes,
      }))
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
      className={`container mx-auto px-4 py-8 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-teal-900 min-h-screen ${
        i18n.language === "ar" ? "text-right" : "text-left"
      }`}
      dir={i18n.language === "ar" ? "rtl" : "ltr"}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-between items-center mb-8"
      >
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          {t("dashboardTitle")}
        </h1>
        <div className="flex space-x-4">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-amber-300 text-gray-800 rounded-lg hover:bg-amber-400 transition-transform transform hover:scale-105"
          >
            {t("exportCSV")}
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-amber-300 text-gray-800 rounded-lg hover:bg-amber-400 transition-transform transform hover:scale-105"
          >
            {t("exportPDF")}
          </button>
          <button
            onClick={() => window.location.href = "/client"}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-transform transform hover:scale-105"
          >
            {t("bookAppointment")}
          </button>
        </div>
      </motion.div>

      {/* Filtres */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8"
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("period")}
            </label>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                setIsCustomDate(e.target.value === "custom");
              }}
              className="w-full p-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("status")}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
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
          <div className="mt-4">
            <DateRange
              editableDateInputs
              onChange={(item) => setDateRange([item.selection])}
              moveRangeOnFirstSelection={false}
              ranges={dateRange}
              className="w-full"
              direction={i18n.language === "ar" ? "horizontal" : "horizontal"}
            />
          </div>
        )}
      </motion.div>

      {/* Métriques */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 animate-pulse"
            >
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : stats.length === 0 && totalAppointments === 0 ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          {t("noAppointments")}
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {statCards.map((card, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-emerald-100 dark:border-emerald-900"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {card.title}
                    </p>
                    <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">
                      {card.value}
                    </p>
                  </div>
                  {card.icon}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Upcoming Appointments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              {t("upcomingAppointments")}
            </h2>
            {appointments.filter((apt) => ['pending', 'accepted'].includes(apt.status)).length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">{t("noAppointments")}</p>
            ) : (
              <div className="space-y-4">
                {appointments
                  .filter((apt) => ["pending", "accepted"].includes(apt.status))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((appointment) => (
                    <div
                      key={appointment._id}
                      className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {format(new Date(appointment.date), "dd/MM/yyyy")} à {appointment.time}
                        </p>
                        <p className="text-gray-800 dark:text-gray-100">
                          Dr. {appointment.doctorId.lastName} ({appointment.doctorId.speciality}) - {t(appointment.status)}
                        </p>
                        {appointment.isFollowUp && <span className="mt-2 inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">{t('followUpAppointment')}</span>}
                        {appointment.isTeleconsultation && appointment.status === "accepted" && (
                          <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                            {timers[appointment._id] || t("consultationEnded")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {appointment.isTeleconsultation && appointment.status === "accepted" && (
                          <button
                            onClick={() => openTeleconsultation(appointment)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            disabled={!appointment.teleconsultation?.jitsiUrl}
                          >
                            <Video className="w-5 h-5" />
                            {t("joinTeleconsultation")}
                          </button>
                        )}
                        {!appointment.teleconsultation?.jitsiUrl && appointment.isTeleconsultation && appointment.status === "accepted" && (
                          <span className="text-sm text-red-600 dark:text-red-400">
                            {t("noTeleconsultationLink")}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setAppointmentToCancel(appointment)}
                          className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </motion.div>

          {appointments.some((apt) => ['completed', 'cancelled'].includes(apt.status)) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800"
            >
              <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">
                {t('appointmentHistory')}
              </h2>
              <div className="space-y-3">
                {appointments
                  .filter((apt) => ['completed', 'cancelled'].includes(apt.status))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((appointment) => (
                    <div key={appointment._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-700">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
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
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                {t("appointmentEvolution")}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="appointments" fill="#10b981" name={t("totalAppointments")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
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
                  <Tooltip formatter={(value, name) => [value, t(name)]} />
                  <Legend formatter={(value) => t(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mt-8 dark:text-gray-100">
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
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
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
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isCancellingAppointment}
                onClick={() => { setAppointmentToCancel(null); setCancellationReason(''); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t('keepAppointment')}
              </button>
              <button
                type="button"
                disabled={isCancellingAppointment || cancellationReason.trim().length < 5}
                onClick={cancelAppointment}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
  );
};

export default PatientDashboard;
