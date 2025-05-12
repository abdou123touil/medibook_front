import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import { Appointment } from '../types';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import Papa from 'papaparse';
import jsPDF from 'jspdf';

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

const CustomTooltip = ({ active, payload, label, statType }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-gray-900 dark:text-white font-semibold">{label}</p>
        <p className="text-indigo-600 dark:text-indigo-400">
          {statType === 'revenue' ? `${value.toLocaleString('fr-FR')} DT` : `${value} patients`}
        </p>
      </div>
    );
  }
  return null;
};

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

export function Statistics() {
  console.log('Statistics component rendering');

  const { user } = useAuthStore();
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [incompleteDetailsCount, setIncompleteDetailsCount] = useState(0);
  const [noShowRate, setNoShowRate] = useState(0);
  const [recurrentPatients, setRecurrentPatients] = useState(0);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [statType, setStatType] = useState<StatType>('revenue');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isDateRangePickerOpen, setIsDateRangePickerOpen] = useState(false);
  const [historicAppointments, setHistoricAppointments] = useState<Appointment[]>([]);
  const [selectedDateAppointments, setSelectedDateAppointments] = useState<Appointment[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });

  console.log('Statistics hooks initialized, user:', user);

  const doctorId = user?.data?.id;

  useEffect(() => {
    console.log('Statistics useEffect triggered, doctorId:', doctorId, 'timeRange:', timeRange);
    if (!doctorId) {
      setError('Utilisateur non authentifié');
      setIsLoading(false);
      return;
    }

    loadStats();
    loadHistoricAppointments();

    return () => {
      setIsLoading(false);
    };
  }, [doctorId, timeRange, statusFilter, dateRange]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token d’authentification manquant');
      }

      let url = `http://localhost:3000/api/appointments/doctor/${doctorId}/stats?timeRange=${timeRange}&statusFilter=${statusFilter}`;
      if (timeRange === 'custom') {
        url += `&startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec du chargement des statistiques');
      }

      const data = await response.json();
      console.log('Fetched stats:', data);

      if (!Array.isArray(data.stats)) {
        throw new Error('Les statistiques reçues ne sont pas dans un format valide');
      }

      const formattedStats = data.stats.map((stat: DailyStats) => {
        console.log('Processing stat:', stat);
        return {
          ...stat,
          date: format(
            parseISO(stat.date),
            timeRange === 'year' ? 'MMM' : 'dd MMM',
            { locale: fr }
          ),
        };
      });
      console.log('Formatted stats:', formattedStats);
      setStats(formattedStats);
      setIncompleteDetailsCount(data.incompleteDetailsCount || 0);
      setNoShowRate(data.noShowRate || 0);
      setRecurrentPatients(data.recurrentPatients || 0);
      setPeakHours(data.peakHours || []);
      setStatusDistribution(data.statusDistribution || []);
    } catch (error) {
      console.error('Error loading statistics:', error);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoricAppointments = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token d’authentification manquant');
      }

      const response = await fetch(
        `http://localhost:3000/api/appointments/doctor/${doctorId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 'Échec du chargement des rendez-vous historiques'
        );
      }

      const data = await response.json();
      console.log('Fetched historic appointments:', data);

      if (!Array.isArray(data.appointments)) {
        throw new Error(
          'Les rendez-vous historiques reçus ne sont pas dans un format valide'
        );
      }

      const historicFiltered = data.appointments.filter(
        (apt: Appointment) =>
          apt.status === 'completed' || apt.status === 'cancelled'
      );
      console.log('Filtered historic appointments:', historicFiltered);
      setHistoricAppointments(historicFiltered);
    } catch (error) {
      console.error('Error loading historic appointments:', error);
      setError('Erreur lors du chargement des rendez-vous historiques');
    }
  };

  const getStatValue = (type: StatType) => {
    const total = stats.reduce(
      (sum, stat) => sum + (type === 'revenue' ? stat.revenue : stat.patients),
      0
    );
    console.log(`Calculated ${type} total:`, total);
    if (type === 'revenue') {
      return `${total.toLocaleString('fr-FR')} DT`;
    }
    return total.toString();
  };

  const openHistoricModal = () => {
    setIsModalOpen(true);
  };

  const closeHistoricModal = () => {
    setIsModalOpen(false);
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
    doc.text('Rapport Statistique', 20, 20);
    doc.setFontSize(12);
    doc.text(`Période: ${timeRange === 'custom' ? `${format(dateRange.startDate, 'dd MMM yyyy', { locale: fr })} - ${format(dateRange.endDate, 'dd MMM yyyy', { locale: fr })}` : timeRange}`, 20, 30);
    doc.text(`Revenus totaux: ${getStatValue('revenue')}`, 20, 40);
    doc.text(`Patients traités: ${getStatValue('patients')}`, 20, 50);
    doc.text(`Taux de no-shows: ${noShowRate.toFixed(2)}%`, 20, 60);
    doc.text(`Patients récurrents: ${recurrentPatients}`, 20, 70);
    doc.text(`Heures de pointe: ${peakHours.map((h) => `${h.time} (${h.count})`).join(', ')}`, 20, 80);

    let y = 90;
    stats.forEach((stat, index) => {
      doc.text(`Date: ${stat.date}, Patients: ${stat.patients}, Revenus: ${stat.revenue} DT`, 20, y + index * 10);
    });

    doc.save(`statistiques_${timeRange}.pdf`);
  };

  if (!user || user.data.role !== 'doctor') {
    console.log('Redirecting from Statistics, user role:', user?.data?.role);
    return <Navigate to="/" replace />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Statistiques
        </h1>
        <div className="bg-red-50 dark:bg-red-900 rounded-lg p-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Statistiques
            </h1>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
              >
                Exporter CSV
              </button>
              <button
                onClick={exportToPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700"
              >
                Exporter PDF
              </button>
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value as TimeRange);
                if (e.target.value !== 'custom') {
                  setIsDateRangePickerOpen(false);
                }
              }}
              className="px-3 py-1 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="day">Derniers 7 jours</option>
              <option value="week">Dernière semaine</option>
              <option value="month">Dernier mois</option>
              <option value="quarter">Dernier trimestre</option>
              <option value="year">Dernière année</option>
              <option value="custom">Personnalisé</option>
            </select>
            {timeRange === 'custom' && (
              <button
                onClick={() => setIsDateRangePickerOpen(!isDateRangePickerOpen)}
                className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
              >
                Choisir dates
              </button>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-1 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">Tous</option>
              <option value="pending">En attente</option>
              <option value="accepted">Acceptés</option>
              <option value="completed">Terminés</option>
              <option value="cancelled">Annulés</option>
            </select>
            <select
              value={statType}
              onChange={(e) => setStatType(e.target.value as StatType)}
              className="px-3 py-1 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="revenue">Revenus</option>
              <option value="patients">Patients</option>
            </select>
          </div>

          {isDateRangePickerOpen && (
            <div className="absolute z-10 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-4">
              <DateRangePicker
                ranges={[dateRange]}
                onChange={handleDateRangeSelect}
                locale={fr}
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="bg-green-50 dark:bg-green-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Revenus{' '}
                  {timeRange === 'month'
                    ? 'mensuels'
                    : timeRange === 'year'
                    ? 'annuels'
                    : timeRange === 'week'
                    ? 'hebdomadaires'
                    : timeRange === 'quarter'
                    ? 'trimestriels'
                    : timeRange === 'day'
                    ? 'journaliers'
                    : 'personnalisés'}
                </h2>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {getStatValue('revenue')}
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  de consultations
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Patients
                </h2>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {getStatValue('patients')}
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  patients traités
                </p>
              </div>

              <div className={`bg-yellow-50 dark:bg-yellow-900 rounded-lg p-6 ${incompleteDetailsCount > 0 ? 'animate-pulse' : ''}`}>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  Détails manquants
                </h2>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {incompleteDetailsCount}
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  rendez-vous sans détails
                </p>
                {incompleteDetailsCount > 0 && (
                  <button
                    onClick={openHistoricModal}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
                  >
                    Compléter les détails
                  </button>
                )}
              </div>

              <div className="bg-red-50 dark:bg-red-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  Taux de no-shows
                </h2>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {noShowRate.toFixed(2)}%
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  rendez-vous manqués
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Patients récurrents
                </h2>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {recurrentPatients}
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  patients revenus
                </p>
              </div>

              <div className="bg-teal-50 dark:bg-teal-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Heures de pointe
                </h2>
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {peakHours.length > 0 ? peakHours.map((h) => h.time).join(', ') : 'Aucune'}
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  créneaux les plus réservés
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Évolution
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="h-96">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : stats.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                  <BarChartIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 text-center">
                    Aucune donnée disponible pour la période sélectionnée.
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                    Essayez de sélectionner une autre période ou vérifiez vos rendez-vous.
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
                        name="Revenus"
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
                        name="Patients"
                        fill="#4F46E5"
                        isAnimationActive={true}
                        animationDuration={1000}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            <div className="h-96">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : statusDistribution.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                  <PieChartIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 text-center">
                    Aucune donnée de statut disponible.
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
        isOpen={isModalOpen}
        onClose={closeHistoricModal}
        appointments={historicAppointments}
      />
      <AppointmentHistoryModal
        isOpen={isDateModalOpen}
        onClose={closeDateModal}
        appointments={selectedDateAppointments}
        title={`Rendez-vous du ${selectedDateAppointments[0]?.date ? format(parseISO(selectedDateAppointments[0].date), 'dd MMM yyyy', { locale: fr }) : ''}`}
      />
    </div>
  );
}