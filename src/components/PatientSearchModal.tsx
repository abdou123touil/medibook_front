import React, { useMemo, useState } from 'react';
import { Search, X, UserRound, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface SearchAppointment {
  _id: string;
  date: string;
  time: string;
  status: string;
  symptoms: string;
  patientId: string | { _id: string; firstName: string; lastName: string };
}

interface PatientSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  consultationCount: number;
  appointment: SearchAppointment;
}

interface PatientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: SearchAppointment[];
  onSelectPatient: (patient: PatientSearchResult) => void;
}

export function PatientSearchModal({ isOpen, onClose, appointments, onSelectPatient }: PatientSearchModalProps) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [visitFilter, setVisitFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  const patients = useMemo(() => {
    const patientsById = new Map<string, PatientSearchResult>();
    const eligibleAppointments = appointments
      .filter((appointment) => ['accepted', 'completed'].includes(appointment.status))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const appointment of eligibleAppointments) {
      if (typeof appointment.patientId === 'string') continue;
      const patient = appointment.patientId;
      const existing = patientsById.get(patient._id);
      if (existing) {
        existing.consultationCount += 1;
        continue;
      }
      patientsById.set(patient._id, {
        id: patient._id,
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        consultationCount: 1,
        appointment,
      });
    }
    return [...patientsById.values()];
  }, [appointments]);

  const normalizedSearch = search.trim().toLocaleLowerCase(i18n.language);
  const filteredPatients = patients
    .filter((patient) => {
      const searchableText = `${patient.firstName} ${patient.lastName} ${patient.appointment.symptoms || ''}`
        .toLocaleLowerCase(i18n.language);
      const visitDate = new Date(patient.appointment.date).getTime();
      const ageInDays = (Date.now() - visitDate) / 86400000;
      const matchesDate = dateFilter === 'all' || (Number.isFinite(ageInDays) && ageInDays <= Number(dateFilter));
      const matchesVisits = visitFilter === 'all' ||
        (visitFilter === 'repeat' ? patient.consultationCount >= 2 : patient.consultationCount === 1);
      return searchableText.includes(normalizedSearch) && matchesDate && matchesVisits;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.appointment.date).getTime() - new Date(b.appointment.date).getTime();
      if (sortBy === 'visits') return b.consultationCount - a.consultationCount || new Date(b.appointment.date).getTime() - new Date(a.appointment.date).getTime();
      if (sortBy === 'name') return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, i18n.language);
      return new Date(b.appointment.date).getTime() - new Date(a.appointment.date).getTime();
    });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('searchPatientRecord')}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <h2 className="text-xl font-bold tracking-tight">{t('patientRecords')}</h2>
          <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('close')}><X /></button>
        </div>
        <div className="p-5">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPatient')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-500">
              {t('patientSearchDateFilter')}
              <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="all">{t('patientSearchAnyDate')}</option>
                <option value="30">{t('patientSearchLast30Days')}</option>
                <option value="90">{t('patientSearchLast90Days')}</option>
                <option value="365">{t('patientSearchLastYear')}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {t('patientSearchVisitFilter')}
              <select value={visitFilter} onChange={(event) => setVisitFilter(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="all">{t('patientSearchAllPatients')}</option>
                <option value="repeat">{t('patientSearchRepeatPatients')}</option>
                <option value="single">{t('patientSearchSingleVisit')}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {t('patientSearchSort')}
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="latest">{t('patientSearchNewestFirst')}</option>
                <option value="oldest">{t('patientSearchOldestFirst')}</option>
                <option value="visits">{t('patientSearchMostVisits')}</option>
                <option value="name">{t('patientSearchNameAZ')}</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><SlidersHorizontal className="h-4 w-4" />{t('patientSearchResultCount', { count: filteredPatients.length })}</div>
          <div className="mt-4 max-h-[55vh] overflow-y-auto space-y-2">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => onSelectPatient(patient)}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <UserRound className="w-5 h-5 shrink-0 text-indigo-600" />
                  <span className="truncate font-medium">{patient.firstName} {patient.lastName}</span>
                </span>
                <span className="text-xs text-slate-500 shrink-0">
                  {t('consultationCount', { count: patient.consultationCount })} · {t('lastAppointmentDate', { date: format(new Date(patient.appointment.date), 'dd/MM/yyyy', { locale: fr }) })}
                </span>
              </button>
            ))}
            {filteredPatients.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                {patients.length === 0 ? t('noConsultedPatients') : t('noPatientMatches')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
