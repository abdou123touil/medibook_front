import React, { useMemo, useState } from 'react';
import { Search, X, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

  const normalizedSearch = search.trim().toLocaleLowerCase('fr');
  const filteredPatients = patients.filter((patient) =>
    `${patient.firstName} ${patient.lastName}`.toLocaleLowerCase('fr').includes(normalizedSearch)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Rechercher une fiche patient">
      <div className="bg-white dark:bg-gray-800 w-full max-w-xl max-h-[85vh] overflow-hidden rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold">Fiches patients</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Fermer"><X /></button>
        </div>
        <div className="p-5">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom ou prénom"
              className="w-full rounded-lg border py-3 pl-10 pr-3 dark:bg-gray-900 dark:border-gray-600"
            />
          </label>
          <div className="mt-4 max-h-[55vh] overflow-y-auto space-y-2">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => onSelectPatient(patient)}
                className="w-full flex items-center justify-between gap-4 p-4 rounded-lg border text-left hover:bg-indigo-50 dark:hover:bg-gray-700"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <UserRound className="w-5 h-5 shrink-0 text-indigo-600" />
                  <span className="truncate font-medium">{patient.firstName} {patient.lastName}</span>
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {patient.consultationCount} consultation{patient.consultationCount === 1 ? '' : 's'} · dernière le {format(new Date(patient.appointment.date), 'dd/MM/yyyy', { locale: fr })}
                </span>
              </button>
            ))}
            {filteredPatients.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                {patients.length === 0 ? 'Aucun patient avec une consultation acceptée ou terminée.' : 'Aucun patient ne correspond à cette recherche.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
