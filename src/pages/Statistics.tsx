import React, { useState, useEffect } from 'react';
import { apiFetch } from "../lib/api";
import { format, parseISO } from 'date-fns';
import { ar, enUS, fr } from 'date-fns/locale';
import { TrendingUp, Users, AlertTriangle, BarChart as BarChartIcon, Clock, UserCheck, PieChart as PieChartIcon } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';
import { AppointmentHistoryModal } from '../components/AppointmentHistoryModal';
import { PatientRecordModal } from '../components/PatientRecordModal';
import { Appointment } from '../types';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';

type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type StatType = 'revenue' | 'patients';
type StatusFilter = 'all' | 'pending' | 'accepted' | 'completed' | 'cancelled';

interface DailyStats {
  date: string;
  patients: number;
  revenue: number;
}

interface StatusData {
  name: string;
  value: number;
}

interface PeakHour {
  time: string;
  count: number;
}

interface PaymentSummary {
  amountCollected: number;
  amountOutstanding: number;
  paidConsultations: number;
  partialConsultations: number;
  unpaidConsultations: number;
}

interface IncompleteAppointment {
  _id: string;
  date: string;
  time: string;
  status: string;
  symptoms: string;
  patientId: { _id: string; firstName: string; lastName: string } | null;
}

const CustomTooltip = ({ active, payload, label, statType }: any) => {
  const { t } = useTranslation();
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-gray-900 dark:text-white font-semibold">{label}</p>
        <p className="text-indigo-600 dark:text-indigo-400">
          {statType === 'revenue' ? `${value.toLocaleString()} DT` : t('patientCount', { count: value })}
        </p>
      </div>
    );
  }
  return null;
};

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

export function Statistics() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enUS : fr;
  

  const { user, isAuthenticated } = useAuthStore();
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [incompleteDetailsCount, setIncompleteDetailsCount] = useState(0);
  const [noShowRate, setNoShowRate] = useState(0);
  const [recurrentPatients, setRecurrentPatients] = useState(0);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({ amountCollected: 0, amountOutstanding: 0, paidConsultations: 0, partialConsultations: 0, unpaidConsultations: 0 });
  const [statusDistribution, setStatusDistribution] = useState<StatusData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [statType, setStatType] = useState<StatType>('revenue');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientRecordAppointment, setPatientRecordAppointment] = useState<IncompleteAppointment | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isDateRangePickerOpen, setIsDateRangePickerOpen] = useState(false);
  const [historicAppointments, setHistoricAppointments] = useState<Appointment[]>([]);
  const [incompleteAppointments, setIncompleteAppointments] = useState<IncompleteAppointment[]>([]);
  const [selectedDateAppointments, setSelectedDateAppointments] = useState<Appointment[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!isAuthenticated) {
        throw new Error(t('authenticationTokenMissing'));
      }

      let url = `http://localhost:3000/api/appointments/doctor/${doctorId}/stats?timeRange=${timeRange}&statusFilter=${statusFilter}`;
      if (timeRange === 'custom') {
        url += `&startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}`;
      }

      const response = await apiFetch(url, {
        headers: {
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('statisticsLoadError'));
      }

      const data = await response.json();

      if (!Array.isArray(data.stats)) {
        throw new Error(t('statisticsInvalidResponse'));
      }

      const formattedStats = data.stats.map((stat: DailyStats) => {
        return {
          ...stat,
          date: format(
            parseISO(stat.date),
            timeRange === 'year' ? 'MMM' : 'dd MMM',
            { locale: fr }
          ),
        };
      });
      setStats(formattedStats);
      const missingAppointments = Array.isArray(data.incompleteAppointments) ? data.incompleteAppointments : [];
      setIncompleteAppointments(missingAppointments);
      setIncompleteDetailsCount(Number(data.incompleteDetailsCount ?? missingAppointments.length) || 0);
      setNoShowRate(data.noShowRate || 0);
      setRecurrentPatients(data.recurrentPatients || 0);
      setPeakHours(data.peakHours || []);
      setStatusDistribution(data.statusDistribution || []);
      setPaymentSummary({
        amountCollected: Number(data.paymentSummary?.amountCollected) || 0,
        amountOutstanding: Number(data.paymentSummary?.amountOutstanding) || 0,
        paidConsultations: Number(data.paymentSummary?.paidConsultations) || 0,
        partialConsultations: Number(data.paymentSummary?.partialConsultations) || 0,
        unpaidConsultations: Number(data.paymentSummary?.unpaidConsultations) || 0,
      });
    } catch (error) {
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setIsLoading(false);
    }
  };

  const doctorId = user?.data?.id;
useEffect(() => {
    if (!doctorId) {
      setError(t('authenticationRequired'));
      setIsLoading(false);
      return;
    }

    loadStats();
    loadHistoricAppointments();

    return () => {
      setIsLoading(false);
    };
  }, [doctorId, timeRange, statusFilter, dateRange]);
  const loadHistoricAppointments = async () => {
    try {
      if (!isAuthenticated) {
        throw new Error(t('authenticationTokenMissing'));
      }

      const response = await apiFetch(
        `http://localhost:3000/api/appointments/doctor/${doctorId}`,
        {
          headers: {
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || t('historyLoadError')
        );
      }

      const data = await response.json();

      if (!Array.isArray(data.appointments)) {
        throw new Error(
          t('historyInvalidResponse')
        );
      }

      const historicFiltered = data.appointments.filter(
        (apt: Appointment) =>
          apt.status === 'completed' || apt.status === 'cancelled'
      );
      setHistoricAppointments(historicFiltered);
    } catch (error) {
      setError('Erreur lors du chargement des rendez-vous historiques');
    }
  };

  const getStatValue = (type: StatType) => {
    const total = stats.reduce(
      (sum, stat) => sum + (type === 'revenue' ? stat.revenue : stat.patients),
      0
    );
    if (type === 'revenue') {
      return `${total.toLocaleString('fr-FR')} DT`;
    }
    return total.toString();
  };

  const openIncompletePatientRecord = () => {
    const nextAppointment = incompleteAppointments.find((item) => item.patientId?._id);
    if (!nextAppointment) return;
    setPatientRecordAppointment(nextAppointment);
  };

  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const selectedDate = data.activePayload[0].payload.date;
      const dateToFilter = parseISO(data.activePayload[0].payload.date).toISOString().split('T')[0];
      const filteredAppointments = historicAppointments.filter(
        (apt) => new Date(apt.date).toISOString().split('T')[0] === dateToFilter
      );
      setSelectedDateAppointments(filteredAppointments);
      setIsDateModalOpen(true);
    }
  };

  const closeDateModal = () => {
    setIsDateModalOpen(false);
    setSelectedDateAppointments([]);
  };

  const handleDateRangeSelect = (ranges: any) => {
    setDateRange(ranges.selection);
    if (ranges.selection.startDate && ranges.selection.endDate) {
      setIsDateRangePickerOpen(false);
    }
  };

  const exportToCSV = () => {
    const csvData = stats.map((stat) => ({
      Date: stat.date,
      Patients: stat.patients,
      Revenus: `${stat.revenue} DT`,
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `statistiques_${timeRange}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(t('statisticsReport'), 20, 20);
    doc.setFontSize(12);
    doc.text(`${t('period')}: ${timeRange === 'custom' ? `${format(dateRange.startDate, 'dd MMM yyyy', { locale: dateLocale })} - ${format(dateRange.endDate, 'dd MMM yyyy', { locale: dateLocale })}` : t(timeRange)}`, 20, 30);
    doc.text(`${t('totalRevenue')}: ${data.totalExpenses}`, 20, 40);
    /*doc.text(`Revenus totaux: ${getStatValue('revenue')}`, 20, 40);*/
    doc.text(`${t('patientsSeen')}: ${getStatValue('patients')}`, 20, 50);
    doc.text(`${t('noShowRate')}: ${noShowRate.toFixed(2)}%`, 20, 60);
    doc.text(`${t('returningPatients')}: ${recurrentPatients}`, 20, 70);
    doc.text(`${t('peakHours')}: ${peakHours.map((h) => `${h.time} (${h.count})`).join(', ')}`, 20, 80);

    let y = 90;
    stats.forEach((stat, index) => {
      doc.text(`${t('date')}: ${stat.date}, ${t('patients')}: ${stat.patients}, ${t('revenue')}: ${stat.revenue} DT`, 20, y + index * 10);
    });

    doc.save(`statistiques_${timeRange}.pdf`);
  };

  if (!user || user.data.role !== 'doctor') {
    
    return <Navigate to="/" replace />;
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8 ${i18n.language.startsWith('ar') ? 'text-right' : 'text-left'}`} dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}>
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-700 to-violet-600 p-6 text-white shadow-xl shadow-indigo-900/10 sm:p-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">{t('doctorDashboard')}</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('statistics')}</h1>
          </header>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8 ${i18n.language.startsWith('ar') ? 'text-right' : 'text-left'}`} dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        <header className="flex flex-col gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-700 to-violet-600 p-6 text-white shadow-xl shadow-indigo-900/10 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden rounded-2xl bg-white/15 p-3 ring-1 ring-white/20 sm:block"><TrendingUp className="h-7 w-7" /></div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">{t('doctorDashboard')}</p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('statistics')}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={exportToCSV}
                className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
              >
                {t('exportCSV')}
              </button>
              <button
                onClick={exportToPDF}
                className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-indigo-800 shadow-sm transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white/70"
              >
                {t('exportPDF')}
              </button>
          </div>
        </header>

        <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value as TimeRange);
                if (e.target.value !== 'custom') {
                  setIsDateRangePickerOpen(false);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="day">{t('last7Days')}</option>
              <option value="week">{t('lastWeek')}</option>
              <option value="month">{t('lastMonth')}</option>
              <option value="quarter">{t('lastQuarter')}</option>
              <option value="year">{t('lastYear')}</option>
              <option value="custom">{t('custom')}</option>
            </select>
            {timeRange === 'custom' && (
              <button
                onClick={() => setIsDateRangePickerOpen(!isDateRangePickerOpen)}
                className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                {t('chooseDates')}
              </button>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('all')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="accepted">{t('accepted')}</option>
              <option value="completed">{t('completed')}</option>
              <option value="cancelled">{t('cancelled')}</option>
            </select>
            <select
              value={statType}
              onChange={(e) => setStatType(e.target.value as StatType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="revenue">{t('revenue')}</option>
              <option value="patients">{t('patients')}</option>
            </select>
          </div>

          {isDateRangePickerOpen && (
            <div className="absolute left-4 top-full z-20 mt-2 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:left-5">
              <DateRangePicker
                ranges={[dateRange]}
                onChange={handleDateRangeSelect}
                locale={dateLocale}
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  {t('revenue')} {' '}
                  {timeRange === 'month'
                    ? t('monthly')
                    : timeRange === 'year'
                    ? t('yearly')
                    : timeRange === 'week'
                    ? t('weekly')
                    : timeRange === 'quarter'
                    ? t('quarterly')
                    : timeRange === 'day'
                    ? t('daily')
                    : t('custom').toLowerCase()}
                </h2>
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {getStatValue('revenue')}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('fromConsultations')}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200"><TrendingUp className="h-5 w-5" />{t('amountCollected')}</h2>
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{paymentSummary.amountCollected.toFixed(2)} DT</div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('paidConsultationsCount', { count: paymentSummary.paidConsultations })} · {t('partialConsultationsCount', { count: paymentSummary.partialConsultations })}</p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/20">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200"><AlertTriangle className="h-5 w-5" />{t('amountOutstanding')}</h2>
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{paymentSummary.amountOutstanding.toFixed(2)} DT</div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('unpaidConsultationsCount', { count: paymentSummary.unpaidConsultations })}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  {t('patients')}
                </h2>
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {getStatValue('patients')}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('patientsSeen')}
                </p>
              </div>

              <div className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${incompleteDetailsCount > 0 ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  {t('missingDetails')}
                </h2>
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {incompleteDetailsCount}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('appointmentsWithoutDetails')}
                </p>
                {incompleteDetailsCount > 0 && (
                  <button
                    onClick={openIncompletePatientRecord}
                    disabled={!incompleteAppointments.some((item) => item.patientId?._id)}
                    className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    {t('completeDetails')}
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  {t('noShowRate')}
                </h2>
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {noShowRate.toFixed(2)}%
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('missedAppointments')}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  {t('returningPatients')}
                </h2>
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {recurrentPatients}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('patientsReturned')}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  {t('peakHours')}
                </h2>
                <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {peakHours.length > 0 ? peakHours.map((h) => h.time).join(', ') : t('none')}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('mostBookedSlots')}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {t('evolution')}
            </h2>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 min-w-0 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:h-96 sm:p-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : stats.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl bg-white p-6 dark:bg-slate-900">
                  <BarChartIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 text-center">
                    {t('noPeriodData')}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                    {t('tryAnotherPeriod')}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {statType === 'revenue' ? (
                    <AreaChart
                      data={stats}
                      onClick={handleChartClick}
                      margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        interval={timeRange === 'month' ? 2 : 0}
                      />
                      <YAxis
                        tickFormatter={(value) => `${value} DT`}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <Tooltip content={<CustomTooltip statType="revenue" />} />
                      <Legend verticalAlign="top" height={36} />
                      <ReferenceLine x={stats[stats.length - 1]?.date} stroke="#9ca3af" strokeDasharray="3 3" />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name={t('revenue')}
                        stroke="#4F46E5"
                        fill="#4F46E5"
                        fillOpacity={0.2}
                        isAnimationActive={true}
                        animationDuration={1000}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart
                      data={stats}
                      onClick={handleChartClick}
                      margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        interval={timeRange === 'month' ? 2 : 0}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <Tooltip content={<CustomTooltip statType="patients" />} />
                      <Legend verticalAlign="top" height={36} />
                      <ReferenceLine x={stats[stats.length - 1]?.date} stroke="#9ca3af" strokeDasharray="3 3" />
                      <Bar
                        dataKey="patients"
                        name={t('patients')}
                        fill="#4F46E5"
                        isAnimationActive={true}
                        animationDuration={1000}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            <div className="h-80 min-w-0 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:h-96 sm:p-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : statusDistribution.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl bg-white p-6 dark:bg-slate-900">
                  <PieChartIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 text-center">
                    {t('noStatusData')}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      <AppointmentHistoryModal
        isOpen={isDateModalOpen}
        onClose={closeDateModal}
        appointments={selectedDateAppointments}
        onDetailsSaved={() => { void loadStats(); }}
        title={t('appointmentsForDate', { date: selectedDateAppointments[0]?.date ? format(parseISO(selectedDateAppointments[0].date), 'dd MMM yyyy', { locale: dateLocale }) : '' })}
      />
      {patientRecordAppointment?.patientId && (
        <PatientRecordModal
          isOpen
          onClose={() => setPatientRecordAppointment(null)}
          patientId={patientRecordAppointment.patientId._id}
          patientName={`${patientRecordAppointment.patientId.firstName || ''} ${patientRecordAppointment.patientId.lastName || ''}`.trim()}
          appointment={patientRecordAppointment}
          onSaved={() => { void loadStats(); }}
        />
      )}
    </div>
  );
}
