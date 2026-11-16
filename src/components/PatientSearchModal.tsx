import React, { useMemo, useState } from 'react';
import { Search, X, UserRound } from 'lucide-react';
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
    return [...patientsById.values()].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr')
    );
  }, [appointments]);

  const normalizedSearch = search.trim().toLocaleLowerCase(i18n.language);
  const filteredPatients = patients.filter((patient) =>
    `${patient.firstName} ${patient.lastName}`.toLocaleLowerCase(i18n.language).includes(normalizedSearch)
  );

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
