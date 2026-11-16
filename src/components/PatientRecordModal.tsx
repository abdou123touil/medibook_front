import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from "../lib/api";
import { X, Save, ClipboardList, Printer, FileText, Pill, Stethoscope, CalendarCheck } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';

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
  followUpAt?: string | null;
}

interface PatientRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  appointment: RecordAppointment;
}

type PrintableDocument = 'prescription' | 'certificate' | 'referral' | 'summary' | 'attendance';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] || character));

const toLocalDateTimeInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function PatientRecordModal({ isOpen, onClose, patientId, patientName, appointment }: PatientRecordModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
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
  const [certificateDuration, setCertificateDuration] = useState('');
  const [referralRecipient, setReferralRecipient] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [availableFollowUpSlots, setAvailableFollowUpSlots] = useState<Record<string, string[]>>({});
  const [isLoadingFollowUpSlots, setIsLoadingFollowUpSlots] = useState(false);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item._id === selectedAppointmentId) || appointment,
    [appointments, selectedAppointmentId, appointment]
  );
  const selectedSavedConsultation = consultations.find((entry) => String(entry.appointmentId) === selectedAppointmentId);
  const currentPrescriptions = prescriptions.split('\n').map((item) => item.trim()).filter(Boolean);
  const followUpSlotOptions = Object.entries(availableFollowUpSlots)
    .flatMap(([date, times]) => times.map((time) => ({ value: `${date}T${time}`, date, time })))
    .sort((a, b) => a.value.localeCompare(b.value));
  if (followUpAt && !followUpSlotOptions.some((slot) => slot.value === followUpAt)) {
    followUpSlotOptions.push({ value: followUpAt, date: followUpAt.slice(0, 10), time: followUpAt.slice(11, 16) });
    followUpSlotOptions.sort((a, b) => a.value.localeCompare(b.value));
  }
  const isConsultationSaved = Boolean(selectedSavedConsultation
    && selectedSavedConsultation.diagnosis === diagnosis
    && selectedSavedConsultation.treatment === treatment
    && selectedSavedConsultation.notes === notes
    && JSON.stringify(selectedSavedConsultation.prescriptions || []) === JSON.stringify(currentPrescriptions)
    && (selectedSavedConsultation.followUpAt ? new Date(selectedSavedConsultation.followUpAt).getTime() : null)
      === (followUpAt ? new Date(followUpAt).getTime() : null));

  const printClinicalDocument = (type: PrintableDocument) => {
    if (!isConsultationSaved) {
      toast.error(t('saveBeforePrint'));
      return;
    }
    if (type === 'prescription' && currentPrescriptions.length === 0) return;
    if (type === 'certificate' && !certificateDuration.trim()) {
      toast.error(t('certificateDurationRequired'));
      return;
    }
    if (type === 'referral' && !referralRecipient.trim()) {
      toast.error(t('referralRecipientRequired'));
      return;
    }

    const doctor = user?.data || user;
    const doctorName = [doctor?.firstName, doctor?.lastName].filter(Boolean).join(' ') || t('doctor');
    const dateLabel = format(new Date(selectedAppointment?.date || appointment.date), 'dd/MM/yyyy', { locale: fr });
    const titleByType: Record<PrintableDocument, string> = {
      prescription: t('medicalPrescription'), certificate: t('medicalCertificate'),
      referral: t('referralLetter'), summary: t('consultationSummary'), attendance: t('attendanceCertificate'),
    };
    const contentByType: Record<PrintableDocument, string> = {
      prescription: `<h2>${t('prescription')}</h2><ul>${currentPrescriptions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>${treatment.trim() ? `<h2>${t('recommendations')}</h2><p>${escapeHtml(treatment).replace(/\n/g, '<br>')}</p>` : ''}`,
      certificate: `<p>${t('certificateBody', { patient: escapeHtml(patientName), days: escapeHtml(certificateDuration.trim()) })}</p>${diagnosis.trim() ? `<p><strong>${t('diagnosis')} :</strong> ${escapeHtml(diagnosis)}</p>` : ''}`,
      referral: `<p>${t('referralRecipient')}: ${escapeHtml(referralRecipient.trim())}</p><p>${t('referralReason')}: ${escapeHtml(referralReason.trim() || diagnosis || treatment || t('notProvided'))}</p>${diagnosis.trim() ? `<p><strong>${t('diagnosis')} :</strong> ${escapeHtml(diagnosis)}</p>` : ''}`,
      summary: `<p><strong>${t('reportedReason')} :</strong> ${escapeHtml(selectedAppointment?.symptoms || t('notProvided'))}</p>${diagnosis.trim() ? `<p><strong>${t('diagnosis')} :</strong> ${escapeHtml(diagnosis)}</p>` : ''}${treatment.trim() ? `<p><strong>${t('recommendations')} :</strong><br>${escapeHtml(treatment).replace(/\n/g, '<br>')}</p>` : ''}${currentPrescriptions.length ? `<h2>${t('prescription')}</h2><ul>${currentPrescriptions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}${notes.trim() ? `<h2>${t('notes')}</h2><p>${escapeHtml(notes).replace(/\n/g, '<br>')}</p>` : ''}${followUpAt ? `<p><strong>${t('followUpRecommended')} :</strong> ${escapeHtml(format(new Date(followUpAt), 'dd/MM/yyyy HH:mm', { locale: fr }))}</p>` : ''}`,
      attendance: `<p>${t('attendanceBody', { patient: escapeHtml(patientName), date: dateLabel, time: escapeHtml(selectedAppointment?.time || appointment.time) })}</p>`,
    };
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('printPopupBlocked'));
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="${escapeHtml(document.documentElement.lang || 'fr')}"><head><meta charset="utf-8"><title>${escapeHtml(titleByType[type])} - ${escapeHtml(patientName)}</title><style>
      body{font:16px/1.55 Arial,sans-serif;color:#111;margin:0;padding:32px}.sheet{max-width:760px;margin:0 auto}.top{display:flex;justify-content:space-between;border-bottom:2px solid #222;padding-bottom:18px}.muted{color:#555}.body{min-height:330px;padding:24px 0}.notice{font-size:12px;color:#555;border:1px solid #aaa;padding:10px;margin-top:24px}.signature{display:flex;justify-content:flex-end;margin-top:70px}.sign{width:240px;border-top:1px solid #555;padding-top:8px;text-align:center}h1{font-size:24px}h2{font-size:17px;margin-top:24px}li{margin:8px 0}@media print{body{padding:0}.sheet{max-width:none;margin:20mm}}
    </style></head><body><main class="sheet"><header class="top"><div><strong>${t('doctor')} ${escapeHtml(doctorName)}</strong><div class="muted">${escapeHtml(doctor?.speciality || '')}</div></div><div>${t('date')}: ${dateLabel}</div></header><h1>${escapeHtml(titleByType[type])}</h1><p><strong>${t('patient')} :</strong> ${escapeHtml(patientName)}</p><p><strong>${t('date')} :</strong> ${dateLabel}</p><section class="body">${contentByType[type]}</section><p class="notice">${t('printSignatureNotice')}</p><div class="signature"><div class="sign">${t('doctor')} · ${t('signatureAndStamp')}</div></div></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`);
    printWindow.document.close();
  };

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
        setFollowUpAt(toLocalDateTimeInput(initialEntry?.followUpAt));
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

  const doctorId = user?.data?.id || (user as any)?.id;
  useEffect(() => {
    if (!isOpen || !doctorId) return;
    let active = true;
    const loadSlots = async () => {
      setIsLoadingFollowUpSlots(true);
      try {
        const startDate = format(new Date(), 'yyyy-MM-dd');
        const endDate = format(addDays(new Date(), 120), 'yyyy-MM-dd');
        const response = await apiFetch(`http://localhost:3000/api/users/doctors/${doctorId}/available-slots?startDate=${startDate}&endDate=${endDate}`);
        const data = response.ok ? await response.json() : { availableSlots: {} };
        if (active) setAvailableFollowUpSlots(data.availableSlots || {});
      } catch {
        if (active) setAvailableFollowUpSlots({});
      } finally {
        if (active) setIsLoadingFollowUpSlots(false);
      }
    };
    loadSlots();
    return () => { active = false; };
  }, [isOpen, doctorId]);

  useEffect(() => {
    const entry = consultations.find((item) => String(item.appointmentId) === selectedAppointmentId);
    setDiagnosis(entry?.diagnosis || '');
    setTreatment(entry?.treatment || '');
    setPrescriptions((entry?.prescriptions || []).join('\n'));
    setNotes(entry?.notes || '');
    setFollowUpAt(toLocalDateTimeInput(entry?.followUpAt));
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
            followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
            followUpDate: followUpAt ? followUpAt.slice(0, 10) : null,
            followUpTime: followUpAt ? followUpAt.slice(11, 16) : null,
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
              <div className="mt-4 rounded-lg border p-4 dark:border-gray-600">
                <label className="block text-sm font-medium">{t('followUpRecommended')}
                  <select value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className="mt-1 w-full rounded-lg border p-3 dark:bg-gray-900">
                    <option value="">{isLoadingFollowUpSlots ? t('loadingFollowUpSlots') : t('noFollowUp')}</option>
                    {followUpSlotOptions.map((slot) => (
                      <option key={slot.value} value={slot.value}>{format(new Date(`${slot.date}T${slot.time}:00`), 'dd/MM/yyyy')} · {slot.time}</option>
                    ))}
                  </select>
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('followUpHelp')}</p>
              </div>
            </section>

            <section className="border-t pt-5 space-y-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Printer className="w-5 h-5 text-indigo-600" />{t('printableDocuments')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('printableDocumentsHelp')}</p>
              </div>
              {!isConsultationSaved && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{t('saveBeforePrint')}</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {currentPrescriptions.length > 0 && <button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('prescription')} className="flex items-center gap-3 rounded-lg border p-3 text-left hover:border-indigo-400 disabled:opacity-50 dark:border-gray-600"><Pill className="h-5 w-5 text-indigo-600" /><span>{t('medicalPrescription')}</span><Printer className="ml-auto h-4 w-4" /></button>}
                <div className="rounded-lg border p-3 dark:border-gray-600">
                  <div className="mb-2 flex items-center gap-2 font-medium"><FileText className="h-5 w-5 text-indigo-600" />{t('medicalCertificate')}</div>
                  <div className="flex gap-2"><input type="number" min="1" value={certificateDuration} onChange={(event) => setCertificateDuration(event.target.value)} placeholder={t('certificateDays')} className="min-w-0 flex-1 rounded-lg border px-3 py-2 dark:bg-gray-900" /><button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('certificate')} className="rounded-lg bg-indigo-600 px-3 text-white disabled:opacity-50"><Printer className="h-4 w-4" /></button></div>
                </div>
                <div className="rounded-lg border p-3 dark:border-gray-600">
                  <div className="mb-2 flex items-center gap-2 font-medium"><Stethoscope className="h-5 w-5 text-indigo-600" />{t('referralLetter')}</div>
                  <input value={referralRecipient} onChange={(event) => setReferralRecipient(event.target.value)} placeholder={t('referralRecipient')} className="mb-2 w-full rounded-lg border px-3 py-2 dark:bg-gray-900" />
                  <div className="flex gap-2"><input value={referralReason} onChange={(event) => setReferralReason(event.target.value)} placeholder={t('referralReason')} className="min-w-0 flex-1 rounded-lg border px-3 py-2 dark:bg-gray-900" /><button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('referral')} className="rounded-lg bg-indigo-600 px-3 text-white disabled:opacity-50"><Printer className="h-4 w-4" /></button></div>
                </div>
                <button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('summary')} className="flex items-center gap-3 rounded-lg border p-3 text-left hover:border-indigo-400 disabled:opacity-50 dark:border-gray-600"><ClipboardList className="h-5 w-5 text-indigo-600" /><span>{t('consultationSummary')}</span><Printer className="ml-auto h-4 w-4" /></button>
                <button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('attendance')} className="flex items-center gap-3 rounded-lg border p-3 text-left hover:border-indigo-400 disabled:opacity-50 dark:border-gray-600"><CalendarCheck className="h-5 w-5 text-indigo-600" /><span>{t('attendanceCertificate')}</span><Printer className="ml-auto h-4 w-4" /></button>
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
