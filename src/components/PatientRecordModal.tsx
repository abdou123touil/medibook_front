import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from "../lib/api";
import { X, Save, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface RecordAppointment {
  _id: string;
  date: string;
  time: string;
  status: string;
  symptoms: string;
}

interface ConsultationEntry {
  appointmentId: string;
  consultationDate: string;
  symptoms: string;
  diagnosis: string;
  treatment: string;
  prescriptions: string[];
  notes: string;
}

interface PatientRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  appointment: RecordAppointment;
}

export function PatientRecordModal({ isOpen, onClose, patientId, patientName, appointment }: PatientRecordModalProps) {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<RecordAppointment[]>([]);
  const [consultations, setConsultations] = useState<ConsultationEntry[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(appointment._id);
  const [allergies, setAllergies] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [prescriptions, setPrescriptions] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item._id === selectedAppointmentId) || appointment,
    [appointments, selectedAppointmentId, appointment]
  );

  useEffect(() => {
    if (!isOpen || !patientId) return;
    let active = true;
    const loadRecord = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const response = await apiFetch(`http://localhost:3000/api/patients/${patientId}/record`, {
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('patientRecordLoadError'));
        if (!active) return;
        const record = data.record;
        const entries: ConsultationEntry[] = record?.consultations || [];
        setAppointments((data.appointments || []).filter((item: RecordAppointment) => ['accepted', 'completed'].includes(item.status)));
        setConsultations(entries);
        setAllergies(record?.allergies || '');
        setMedicalHistory(record?.medicalHistory || '');
        setCurrentMedications(record?.currentMedications || '');
        const hasClinicalData = (entry: ConsultationEntry) => Boolean(
          entry.diagnosis?.trim() || entry.treatment?.trim() || entry.notes?.trim() || entry.prescriptions?.length
        );
        const requestedEntry = entries.find((item) => String(item.appointmentId) === appointment._id);
        const latestSavedEntry = entries.find(hasClinicalData);
        const initialEntry = requestedEntry && hasClinicalData(requestedEntry)
          ? requestedEntry
          : latestSavedEntry || requestedEntry;
        const initialAppointmentId = String(initialEntry?.appointmentId || appointment._id);
        setSelectedAppointmentId(initialAppointmentId);
        setDiagnosis(initialEntry?.diagnosis || '');
        setTreatment(initialEntry?.treatment || '');
        setPrescriptions((initialEntry?.prescriptions || []).join('\n'));
        setNotes(initialEntry?.notes || '');
      } catch (error) {
        if (active) {
          setLoadError((error as Error).message);
          toast.error((error as Error).message);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadRecord();
    return () => { active = false; };
  }, [isOpen, patientId, appointment._id]);

  useEffect(() => {
    const entry = consultations.find((item) => String(item.appointmentId) === selectedAppointmentId);
    setDiagnosis(entry?.diagnosis || '');
    setTreatment(entry?.treatment || '');
    setPrescriptions((entry?.prescriptions || []).join('\n'));
    setNotes(entry?.notes || '');
  }, [selectedAppointmentId, consultations]);

  const saveRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await apiFetch(`http://localhost:3000/api/patients/${patientId}/record`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allergies,
          medicalHistory,
          currentMedications,
          consultation: {
            appointmentId: selectedAppointmentId,
            diagnosis,
            treatment,
            prescriptions: prescriptions.split('\n').map((item) => item.trim()).filter(Boolean),
            notes,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('patientRecordSaveError'));
      setConsultations(data.record.consultations || []);
      toast.success(t('patientRecordSaved'));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${t('patientRecord')} ${patientName}`}>
      <div className="bg-white dark:bg-gray-800 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2"><ClipboardList className="w-6 h-6 text-indigo-600" />{t('patientRecord')}</h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1">{patientName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={t('close')}><X /></button>
        </div>

        {isLoading ? <p className="py-10 text-center">{t('loadingPatientRecord')}</p> : loadError ? (
          <div className="py-8 text-center text-red-600">
            <p>{loadError}</p>
            <button type="button" onClick={onClose} className="mt-4 px-4 py-2 rounded-lg border">{t('close')}</button>
          </div>
        ) : (
          <form onSubmit={saveRecord} className="space-y-5">
            <section className="grid md:grid-cols-2 gap-4">
              <label className="text-sm font-medium">{t('allergies')}
                <textarea value={allergies} onChange={(event) => setAllergies(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900" placeholder={t('allergiesPlaceholder')} />
              </label>
              <label className="text-sm font-medium">{t('medicalHistory')}
                <textarea value={medicalHistory} onChange={(event) => setMedicalHistory(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900" placeholder={t('medicalHistoryPlaceholder')} />
              </label>
              <label className="text-sm font-medium md:col-span-2">{t('currentMedications')}
                <textarea value={currentMedications} onChange={(event) => setCurrentMedications(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900" placeholder={t('currentMedicationsPlaceholder')} />
              </label>
            </section>

            <section className="border-t pt-5">
              <h3 className="font-semibold mb-3">{t('consultationsWithYou')}</h3>
              <label className="block text-sm font-medium">{t('selectConsultationToEdit')}
                <select value={selectedAppointmentId} onChange={(event) => setSelectedAppointmentId(event.target.value)} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900">
                  {appointments.map((item) => (
                    <option key={item._id} value={item._id}>
                      {format(new Date(item.date), 'dd/MM/yyyy', { locale: fr })} {t('at')} {item.time} — {t(item.status)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-gray-500 mt-2">{t('reportedReason')}: {selectedAppointment?.symptoms || t('notProvided')}</p>
              {consultations.length > 0 && (
                <details className="mt-4 rounded-lg border dark:border-gray-700">
                  <summary className="cursor-pointer px-4 py-3 font-medium">
                    {t('previouslySavedConsultations', { count: consultations.length })}
                  </summary>
                  <div className="border-t dark:border-gray-700 divide-y dark:divide-gray-700">
                    {consultations.map((entry) => (
                      <div key={String(entry.appointmentId)} className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {format(new Date(entry.consultationDate), 'dd/MM/yyyy', { locale: fr })}
                            {entry.appointmentId && selectedAppointmentId === String(entry.appointmentId) && ` · ${t('displayedConsultation')}`}
                          </p>
                          <button
                            type="button"
                            onClick={() => setSelectedAppointmentId(String(entry.appointmentId))}
                            className="text-sm text-indigo-600 hover:underline"
                          >
                            {t('viewEdit')}
                          </button>
                        </div>
                        {entry.diagnosis && <p className="mt-2 text-sm"><strong>{t('diagnosis')}:</strong> {entry.diagnosis}</p>}
                        {entry.treatment && <p className="mt-1 text-sm"><strong>{t('recommendations')}:</strong> {entry.treatment}</p>}
                        {entry.prescriptions?.length > 0 && <p className="mt-1 text-sm"><strong>{t('prescription')}:</strong> {entry.prescriptions.join(', ')}</p>}
                        {entry.notes && <p className="mt-1 text-sm whitespace-pre-line"><strong>{t('notes')}:</strong> {entry.notes}</p>}
                        {!entry.diagnosis && !entry.treatment && !entry.notes && !entry.prescriptions?.length && (
                          <p className="mt-2 text-sm text-gray-500">{t('noMedicalNotes')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <label className="text-sm font-medium">{t('diagnosis')}
                  <textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900" />
                </label>
                <label className="text-sm font-medium">{t('treatmentRecommendations')}
                  <textarea value={treatment} onChange={(event) => setTreatment(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900" />
                </label>
                <label className="text-sm font-medium">{t('prescriptionPerLine')}
                  <textarea value={prescriptions} onChange={(event) => setPrescriptions(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900" placeholder={t('medicationAndDosage')} />
                </label>
                <label className="text-sm font-medium">{t('consultationNotes')}
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900" />
                </label>
              </div>
            </section>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border">{t('close')}</button>
              <button type="submit" disabled={isSaving || appointments.length === 0} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50 flex items-center gap-2"><Save className="w-4 h-4" />{isSaving ? t('saving') : t('savePatientRecord')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
