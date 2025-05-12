import React, { useState, useEffect } from "react";
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
  teleconsultation?: { jitsiUrl: string; status: string };
  doctorId: { firstName: string; lastName: string; speciality: string };
}

const STATUS_COLORS: { [key: string]: string } = {
  cancelled: "#ef4444",
  completed: "#10b981",
  accepted: "#3b82f6",
  pending: "#f59e0b",
};

const PatientDashboard = () => {
  const { t, i18n } = useTranslation();
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
  const [isTeleconsultationModalOpen, setIsTeleconsultationModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const users = localStorage.getItem("user");
  const parsedUser = users ? JSON.parse(users) : null;
  const userId = parsedUser?.data?.id || null;

  // State for timers
  const [timers, setTimers] = useState<{ [key: string]: string | null }>({});

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) {
        console.error("Erreur: Aucun utilisateur connecté ou ID manquant.");
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
        const response = await fetch(
          `http://localhost:3000/api/appointments/patient/${userId}/stats?${params}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("errorFetch"));
        }

        const data: StatsResponse = await response.json();
        setStats(data.stats || []);
        setTotalAppointments(data.totalAppointments || 0);
        setTotalExpenses(data.totalExpenses || 0);
        setUpcomingAppointments(data.upcomingAppointments || 0);
        setCompletionRate(data.completionRate || 0);
        setStatusDistribution(data.statusDistribution || []);
        setLoading(false);
      } catch (err: any) {
        console.error("Erreur lors de la récupération des stats:", err);
        setError(err.message || t("errorFetch"));
        setLoading(false);
      }
    };

    const fetchAppointments = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://localhost:3000/api/appointments/patient/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error(t("errorFetchAppointments"));
        }
        const data = await response.json();
        console.log("Appointments received:", data.appointments); // Debug log
        setAppointments(data.appointments || []);
      } catch (err) {
        console.error("Erreur:", err);
        toast.error(t("errorFetchAppointments"));
      }
    };

    if (userId) {
      fetchStats();
      fetchAppointments();
    }
  }, [userId, timeRange, statusFilter, dateRange, isCustomDate, t]);

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

  const hasTeleconsultation = appointments.some(
    (apt) => apt.isTeleconsultation && apt.status === "accepted"
  );

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
            {appointments.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">{t("noAppointments")}</p>
            ) : !hasTeleconsultation ? (
              <p className="text-gray-600 dark:text-gray-400">{t("noVideoAppointments")}</p>
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
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </motion.div>

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

      <AppointmentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        appointments={appointments}
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
};

export default PatientDashboard;