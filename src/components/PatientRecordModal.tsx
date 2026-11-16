import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from "../lib/api";
import { X, Save, ClipboardList, Printer, FileText, Pill, Stethoscope, CalendarCheck, Plus, Trash2, Pencil } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { displayPrescriptionValue, normalizePrescriptions, type PrescriptionItem } from '../lib/prescriptions';

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
  prescriptions: Array<string | PrescriptionItem>;
  notes: string;
  followUpAt?: string | null;
  followUpAppointmentId?: string | null;
}

interface PrescriptionItem {
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

const emptyPrescription: PrescriptionItem = {
  name: '', dosage: '', route: '', frequency: '', duration: '', quantity: '', instructions: '',
};

type PrescriptionSelectField = 'dosage' | 'route' | 'frequency' | 'duration';
const prescriptionOptions: Record<PrescriptionSelectField, Array<{ value: string; label: string }>> = {
  dosage: [
    { value: 'preset:doseHalfTablet', label: 'doseHalfTablet' }, { value: 'preset:doseOneTablet', label: 'doseOneTablet' },
    { value: 'preset:doseTwoTablets', label: 'doseTwoTablets' }, { value: 'preset:doseFiveMl', label: 'doseFiveMl' },
    { value: 'preset:doseTenMl', label: 'doseTenMl' }, { value: 'preset:doseOneDrop', label: 'doseOneDrop' },
    { value: 'preset:doseTwoDrops', label: 'doseTwoDrops' }, { value: 'preset:doseOnePuff', label: 'doseOnePuff' },
    { value: 'preset:doseTwoPuffs', label: 'doseTwoPuffs' },
  ],
  route: [
    { value: 'preset:routeOral', label: 'routeOral' }, { value: 'preset:routeSublingual', label: 'routeSublingual' },
    { value: 'preset:routeTopical', label: 'routeTopical' }, { value: 'preset:routeInhaled', label: 'routeInhaled' },
    { value: 'preset:routeNasal', label: 'routeNasal' }, { value: 'preset:routeOphthalmic', label: 'routeOphthalmic' },
    { value: 'preset:routeOtic', label: 'routeOtic' }, { value: 'preset:routeRectal', label: 'routeRectal' },
    { value: 'preset:routeSubcutaneous', label: 'routeSubcutaneous' }, { value: 'preset:routeIntramuscular', label: 'routeIntramuscular' },
    { value: 'preset:routeIntravenous', label: 'routeIntravenous' },
  ],
  frequency: [
    { value: 'preset:frequencyDaily', label: 'frequencyDaily' }, { value: 'preset:frequencyTwiceDaily', label: 'frequencyTwiceDaily' },
    { value: 'preset:frequencyThreeDaily', label: 'frequencyThreeDaily' }, { value: 'preset:frequencyEvery8Hours', label: 'frequencyEvery8Hours' },
    { value: 'preset:frequencyEvery12Hours', label: 'frequencyEvery12Hours' }, { value: 'preset:frequencyAsNeeded', label: 'frequencyAsNeeded' },
    { value: 'preset:frequencyWeekly', label: 'frequencyWeekly' },
  ],
  duration: [
    { value: 'preset:duration3Days', label: 'duration3Days' }, { value: 'preset:duration5Days', label: 'duration5Days' },
    { value: 'preset:duration7Days', label: 'duration7Days' }, { value: 'preset:duration10Days', label: 'duration10Days' },
    { value: 'preset:duration14Days', label: 'duration14Days' }, { value: 'preset:durationLongTerm', label: 'durationLongTerm' },
    { value: 'preset:durationUntilFollowUp', label: 'durationUntilFollowUp' },
  ],
};

function PrescriptionSelect({ field, value, onChange }: { field: PrescriptionSelectField; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const options = prescriptionOptions[field];
  const isCustom = value === '__custom__' || Boolean(value && !options.some((option) => option.value === value));
  return (
    <>
      <select value={isCustom ? '__custom__' : value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <option value="">{t('select')}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
        <option value="__custom__">{t('custom')}</option>
      </select>
      {isCustom && <input value={value === '__custom__' ? '' : value} onChange={(event) => onChange(event.target.value)} placeholder={t('custom')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />}
    </>
  );
}

const formatPrescription = (item: PrescriptionItem, t: (key: string) => string) => {
  const details = [item.dosage, item.route, item.frequency, item.duration, item.quantity]
    .filter(Boolean).map((value) => displayPrescriptionValue(value, t)).join(' · ');
  return `${item.name}${details ? ` — ${details}` : ''}${item.instructions ? ` (${t('instructions')}: ${item.instructions})` : ''}`;
};

interface PatientRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  appointment: RecordAppointment;
  onSaved?: () => void;
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

export function PatientRecordModal({ isOpen, onClose, patientId, patientName, appointment, onSaved }: PatientRecordModalProps) {
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
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [prescriptionDraft, setPrescriptionDraft] = useState<PrescriptionItem>({ ...emptyPrescription });
  const [editingPrescriptionIndex, setEditingPrescriptionIndex] = useState<number | null>(null);
  const [medicationSuggestions, setMedicationSuggestions] = useState<string[]>([]);
  const [isSearchingMedications, setIsSearchingMedications] = useState(false);
  const [hasUnrecognizedPrescriptions, setHasUnrecognizedPrescriptions] = useState(false);
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
  const hasUnbookedLegacyFollowUp = Boolean(selectedSavedConsultation?.followUpAt && !selectedSavedConsultation.followUpAppointmentId);
  const currentPrescriptions = prescriptions.filter((item) => item.name.trim());
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
    && JSON.stringify(normalizePrescriptions(selectedSavedConsultation.prescriptions)) === JSON.stringify(currentPrescriptions)
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
      prescription: `<h2>${t('prescription')}</h2><ol>${currentPrescriptions.map((item) => `<li><strong>${escapeHtml(item.name)}</strong>${item.dosage ? `<p>${t('dosage')}: ${escapeHtml(displayPrescriptionValue(item.dosage, t))}</p>` : ''}${item.route ? `<p>${t('routeOfAdministration')}: ${escapeHtml(displayPrescriptionValue(item.route, t))}</p>` : ''}${item.frequency ? `<p>${t('frequency')}: ${escapeHtml(displayPrescriptionValue(item.frequency, t))}</p>` : ''}${item.duration ? `<p>${t('duration')}: ${escapeHtml(displayPrescriptionValue(item.duration, t))}</p>` : ''}${item.quantity ? `<p>${t('quantity')}: ${escapeHtml(item.quantity)}</p>` : ''}${item.instructions ? `<p>${t('instructions')}: ${escapeHtml(item.instructions)}</p>` : ''}</li>`).join('')}</ol>${treatment.trim() ? `<h2>${t('recommendations')}</h2><p>${escapeHtml(treatment).replace(/\n/g, '<br>')}</p>` : ''}`,
      certificate: `<p>${t('certificateBody', { patient: escapeHtml(patientName), days: escapeHtml(certificateDuration.trim()) })}</p>${diagnosis.trim() ? `<p><strong>${t('diagnosis')} :</strong> ${escapeHtml(diagnosis)}</p>` : ''}`,
      referral: `<p>${t('referralRecipient')}: ${escapeHtml(referralRecipient.trim())}</p><p>${t('referralReason')}: ${escapeHtml(referralReason.trim() || diagnosis || treatment || t('notProvided'))}</p>${diagnosis.trim() ? `<p><strong>${t('diagnosis')} :</strong> ${escapeHtml(diagnosis)}</p>` : ''}`,
      summary: `<p><strong>${t('reportedReason')} :</strong> ${escapeHtml(selectedAppointment?.symptoms || t('notProvided'))}</p>${diagnosis.trim() ? `<p><strong>${t('diagnosis')} :</strong> ${escapeHtml(diagnosis)}</p>` : ''}${treatment.trim() ? `<p><strong>${t('recommendations')} :</strong><br>${escapeHtml(treatment).replace(/\n/g, '<br>')}</p>` : ''}${currentPrescriptions.length ? `<h2>${t('prescription')}</h2><ul>${currentPrescriptions.map((item) => `<li>${escapeHtml(formatPrescription(item, t))}</li>`).join('')}</ul>` : ''}${notes.trim() ? `<h2>${t('notes')}</h2><p>${escapeHtml(notes).replace(/\n/g, '<br>')}</p>` : ''}${followUpAt ? `<p><strong>${t('followUpRecommended')} :</strong> ${escapeHtml(format(new Date(followUpAt), 'dd/MM/yyyy HH:mm', { locale: fr }))}</p>` : ''}`,
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
        setHasUnrecognizedPrescriptions((initialEntry?.prescriptions || []).some((item) => !normalizePrescriptions([item]).length));
        const initialAppointmentId = String(initialEntry?.appointmentId || appointment._id);
        setSelectedAppointmentId(initialAppointmentId);
        setDiagnosis(initialEntry?.diagnosis || '');
        setTreatment(initialEntry?.treatment || '');
        setPrescriptions(normalizePrescriptions(initialEntry?.prescriptions));
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
    setPrescriptions(normalizePrescriptions(entry?.prescriptions));
    setHasUnrecognizedPrescriptions((entry?.prescriptions || []).some((item) => !normalizePrescriptions([item]).length));
    setPrescriptionDraft({ ...emptyPrescription });
    setMedicationSuggestions([]);
    setNotes(entry?.notes || '');
    setFollowUpAt(toLocalDateTimeInput(entry?.followUpAt));
  }, [selectedAppointmentId, consultations]);

  useEffect(() => {
    const query = prescriptionDraft.name.trim();
    if (!isOpen || query.length < 2) {
      setMedicationSuggestions([]);
      setIsSearchingMedications(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearchingMedications(true);
      try {
        const response = await apiFetch(`http://localhost:3000/api/medications/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = response.ok ? await response.json() : { results: [] };
        setMedicationSuggestions(Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setMedicationSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setIsSearchingMedications(false);
      }
    }, 300);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [prescriptionDraft.name, isOpen]);

  const addPrescription = () => {
    const name = prescriptionDraft.name.trim();
    if (!name) return;
    const completeDraft = Object.fromEntries(Object.entries(prescriptionDraft).map(([key, value]) => [key, value === '__custom__' ? '' : value])) as PrescriptionItem;
    setPrescriptions((items) => editingPrescriptionIndex === null
      ? [...items, { ...completeDraft, name }]
      : items.map((item, index) => index === editingPrescriptionIndex ? { ...completeDraft, name } : item));
    setPrescriptionDraft({ ...emptyPrescription });
    setEditingPrescriptionIndex(null);
    setMedicationSuggestions([]);
  };

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
            prescriptions: currentPrescriptions,
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
      setHasUnrecognizedPrescriptions(false);
      toast.success(t('patientRecordSaved'));
      onSaved?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${t('patientRecord')} ${patientName}`}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2"><ClipboardList className="w-6 h-6 text-indigo-600" />{t('patientRecord')}</h2>
            <p className="text-slate-600 dark:text-slate-300 mt-1">{patientName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('close')}><X /></button>
        </div>

        {isLoading ? <p className="py-10 text-center">{t('loadingPatientRecord')}</p> : loadError ? (
          <div className="py-8 text-center text-red-600">
            <p>{loadError}</p>
            <button type="button" onClick={onClose} className="mt-4 px-4 py-2 rounded-xl border">{t('close')}</button>
          </div>
        ) : (
          <form onSubmit={saveRecord} className="space-y-5">
            <section className="grid md:grid-cols-2 gap-4">
              <label className="text-sm font-medium">{t('allergies')}
                <textarea value={allergies} onChange={(event) => setAllergies(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950" placeholder={t('allergiesPlaceholder')} />
              </label>
              <label className="text-sm font-medium">{t('medicalHistory')}
                <textarea value={medicalHistory} onChange={(event) => setMedicalHistory(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950" placeholder={t('medicalHistoryPlaceholder')} />
              </label>
              <label className="text-sm font-medium md:col-span-2">{t('currentMedications')}
                <textarea value={currentMedications} onChange={(event) => setCurrentMedications(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950" placeholder={t('currentMedicationsPlaceholder')} />
              </label>
            </section>

            <section className="border-t pt-5">
              <h3 className="font-semibold mb-3">{t('consultationsWithYou')}</h3>
              <label className="block text-sm font-medium">{t('selectConsultationToEdit')}
                <select value={selectedAppointmentId} onChange={(event) => setSelectedAppointmentId(event.target.value)} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950">
                  {appointments.map((item) => (
                    <option key={item._id} value={item._id}>
                      {format(new Date(item.date), 'dd/MM/yyyy', { locale: fr })} {t('at')} {item.time} — {t(item.status)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-slate-500 mt-2">{t('reportedReason')}: {selectedAppointment?.symptoms || t('notProvided')}</p>
              {consultations.length > 0 && (
                <details className="mt-4 rounded-xl border dark:border-slate-800">
                  <summary className="cursor-pointer px-4 py-3 font-medium">
                    {t('previouslySavedConsultations', { count: consultations.length })}
                  </summary>
                  <div className="border-t dark:border-slate-800 divide-y dark:divide-gray-700">
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
                        {entry.prescriptions?.length > 0 && <div className="mt-2 text-sm"><strong>{t('prescription')}:</strong><ul className="mt-1 list-disc pl-5">{normalizePrescriptions(entry.prescriptions).map((item, index) => <li key={`${item.name}-${index}`}>{formatPrescription(item, t)}</li>)}</ul></div>}
                        {entry.notes && <p className="mt-1 text-sm whitespace-pre-line"><strong>{t('notes')}:</strong> {entry.notes}</p>}
                        {!entry.diagnosis && !entry.treatment && !entry.notes && !entry.prescriptions?.length && (
                          <p className="mt-2 text-sm text-slate-500">{t('noMedicalNotes')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <label className="text-sm font-medium">{t('diagnosis')}
                  <textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950" />
                </label>
                <label className="text-sm font-medium">{t('treatmentRecommendations')}
                  <textarea value={treatment} onChange={(event) => setTreatment(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950" />
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50 md:col-span-2">
                  <div className="mb-3 flex items-center gap-2 font-semibold"><Pill className="h-5 w-5 text-indigo-600" />{t('prescription')}</div>
                  {hasUnrecognizedPrescriptions && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{t('unrecognizedPrescriptionNotice')}</p>}
                  <div className="relative">
                    <label className="mb-1 block text-sm font-medium">{t('medicationName')}</label>
                    <input value={prescriptionDraft.name} onChange={(event) => setPrescriptionDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder={t('searchMedication')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900" />
                    {(isSearchingMedications || medicationSuggestions.length > 0) && (
                      <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        {isSearchingMedications && <p className="px-3 py-2 text-sm text-slate-500">{t('searchingMedications')}</p>}
                        {medicationSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setPrescriptionDraft((draft) => ({ ...draft, name: suggestion })); setMedicationSuggestions([]); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-slate-800">{suggestion}</button>)}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('medicationCatalogDisclaimer')}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('dosage')}<PrescriptionSelect field="dosage" value={prescriptionDraft.dosage} onChange={(value) => setPrescriptionDraft((draft) => ({ ...draft, dosage: value }))} /></label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('routeOfAdministration')}<PrescriptionSelect field="route" value={prescriptionDraft.route} onChange={(value) => setPrescriptionDraft((draft) => ({ ...draft, route: value }))} /></label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('frequency')}<PrescriptionSelect field="frequency" value={prescriptionDraft.frequency} onChange={(value) => setPrescriptionDraft((draft) => ({ ...draft, frequency: value }))} /></label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('duration')}<PrescriptionSelect field="duration" value={prescriptionDraft.duration} onChange={(value) => setPrescriptionDraft((draft) => ({ ...draft, duration: value }))} /></label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('quantity')}<input value={prescriptionDraft.quantity} onChange={(event) => setPrescriptionDraft((draft) => ({ ...draft, quantity: event.target.value }))} placeholder={t('quantityExample')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:col-span-2 lg:col-span-1">{t('instructions')}<input value={prescriptionDraft.instructions} onChange={(event) => setPrescriptionDraft((draft) => ({ ...draft, instructions: event.target.value }))} placeholder={t('instructionsExample')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
                  </div>
                  <button type="button" disabled={!prescriptionDraft.name.trim()} onClick={addPrescription} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{editingPrescriptionIndex === null ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}{editingPrescriptionIndex === null ? t('addMedication') : t('save')}</button>
                  {prescriptions.length > 0 && <div className="mt-4 space-y-2">{prescriptions.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{[item.dosage, item.route, item.frequency, item.duration, item.quantity].filter(Boolean).map((value) => displayPrescriptionValue(value, t)).join(' · ') || t('notSpecified')}</p>{item.instructions && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.instructions}</p>}</div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => { setPrescriptionDraft({ ...item }); setEditingPrescriptionIndex(index); }} className="rounded-lg p-2 text-indigo-600 transition hover:bg-indigo-50 dark:hover:bg-slate-800" aria-label={`${t('viewEdit')} ${item.name}`}><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => { setPrescriptions((items) => items.filter((_, itemIndex) => itemIndex !== index)); if (editingPrescriptionIndex === index) { setPrescriptionDraft({ ...emptyPrescription }); setEditingPrescriptionIndex(null); } }} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30" aria-label={`${t('delete')} ${item.name}`}><Trash2 className="h-4 w-4" /></button></div></div>)}</div>}
                </div>
                <label className="text-sm font-medium">{t('consultationNotes')}
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950" />
                </label>
              </div>
              <div className="mt-4 rounded-xl border p-4 dark:border-slate-700">
                <label className="block text-sm font-medium">{t('followUpRecommended')}
                  <select value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950">
                    <option value="">{isLoadingFollowUpSlots ? t('loadingFollowUpSlots') : t('noFollowUp')}</option>
                    {followUpSlotOptions.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {format(new Date(`${slot.date}T${slot.time}:00`), 'dd/MM/yyyy')} · {slot.time}
                        {hasUnbookedLegacyFollowUp && slot.value === followUpAt ? ` · ${t('followUpNeedsConfirmation')}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('followUpHelp')}</p>
                {hasUnbookedLegacyFollowUp && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{t('legacyFollowUpNotice')}</p>}
              </div>
            </section>

            <section className="border-t pt-5 space-y-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Printer className="w-5 h-5 text-indigo-600" />{t('printableDocuments')}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('printableDocumentsHelp')}</p>
              </div>
              {!isConsultationSaved && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{t('saveBeforePrint')}</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {currentPrescriptions.length > 0 && <button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('prescription')} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:border-indigo-400 disabled:opacity-50 dark:border-slate-700"><Pill className="h-5 w-5 text-indigo-600" /><span>{t('medicalPrescription')}</span><Printer className="ml-auto h-4 w-4" /></button>}
                <div className="rounded-xl border p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center gap-2 font-medium"><FileText className="h-5 w-5 text-indigo-600" />{t('medicalCertificate')}</div>
                  <div className="flex gap-2"><input type="number" min="1" value={certificateDuration} onChange={(event) => setCertificateDuration(event.target.value)} placeholder={t('certificateDays')} className="min-w-0 flex-1 rounded-xl border px-3 py-2 dark:bg-slate-950" /><button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('certificate')} className="rounded-xl bg-indigo-600 px-3 text-white disabled:opacity-50"><Printer className="h-4 w-4" /></button></div>
                </div>
                <div className="rounded-xl border p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center gap-2 font-medium"><Stethoscope className="h-5 w-5 text-indigo-600" />{t('referralLetter')}</div>
                  <input value={referralRecipient} onChange={(event) => setReferralRecipient(event.target.value)} placeholder={t('referralRecipient')} className="mb-2 w-full rounded-xl border px-3 py-2 dark:bg-slate-950" />
                  <div className="flex gap-2"><input value={referralReason} onChange={(event) => setReferralReason(event.target.value)} placeholder={t('referralReason')} className="min-w-0 flex-1 rounded-xl border px-3 py-2 dark:bg-slate-950" /><button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('referral')} className="rounded-xl bg-indigo-600 px-3 text-white disabled:opacity-50"><Printer className="h-4 w-4" /></button></div>
                </div>
                <button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('summary')} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:border-indigo-400 disabled:opacity-50 dark:border-slate-700"><ClipboardList className="h-5 w-5 text-indigo-600" /><span>{t('consultationSummary')}</span><Printer className="ml-auto h-4 w-4" /></button>
                <button type="button" disabled={!isConsultationSaved} onClick={() => printClinicalDocument('attendance')} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:border-indigo-400 disabled:opacity-50 dark:border-slate-700"><CalendarCheck className="h-5 w-5 text-indigo-600" /><span>{t('attendanceCertificate')}</span><Printer className="ml-auto h-4 w-4" /></button>
              </div>
            </section>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border">{t('close')}</button>
              <button type="submit" disabled={isSaving || appointments.length === 0} className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50 flex items-center gap-2"><Save className="w-4 h-4" />{isSaving ? t('saving') : t('savePatientRecord')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
