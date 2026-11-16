import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from "../lib/api";
import { X, Save, ClipboardList, Printer, FileText, Pill, Stethoscope, CalendarCheck, Plus, Trash2, Pencil, Paperclip, Upload, Download } from 'lucide-react';
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

interface MedicalAttachment {
  _id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
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
  const [doctorDocumentProfile, setDoctorDocumentProfile] = useState<Record<string, string | undefined> | null>(null);
  const [patientProfile, setPatientProfile] = useState<{ firstName: string; lastName: string } | null>(null);
  const [attachments, setAttachments] = useState<MedicalAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

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

    const doctor = doctorDocumentProfile || user?.data || user;
    const doctorName = [doctor?.firstName, doctor?.lastName].filter(Boolean).join(' ') || t('doctor');
    const doctorContact = [doctor?.hospitalName, doctor?.address, doctor?.phoneNumber, doctor?.professionalRegistrationNumber ? `${t('professionalRegistrationNumber')}: ${doctor.professionalRegistrationNumber}` : ''].filter(Boolean);
    const customDocumentHeader = typeof doctor?.documentHeader === 'string' ? doctor.documentHeader.trim() : '';
    const customDocumentFooter = typeof doctor?.documentFooter === 'string' ? doctor.documentFooter.trim() : '';
    const printedPatientFirstName = patientProfile?.firstName || patientName.split(' ').slice(0, -1).join(' ') || patientName;
    const printedPatientLastName = patientProfile?.lastName || patientName.split(' ').slice(-1)[0] || '';
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
    const medicalEmblem = `<svg viewBox="0 0 180 180" aria-hidden="true"><path d="M90 21v130" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M90 32c-18-3-33-1-50-11 5 12 15 20 34 21M90 32c18-3 33-1 50-11-5 12-15 20-34 21" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M90 57c-24 0-26 24 0 31s24 30 0 31-24 23 0 30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M90 57c24 0 26 24 0 31s-24 30 0 31 24 23 0 30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="90" cy="15" r="7" fill="currentColor"/></svg>`;
    const prescriptionMarkup = `<main class="rx-sheet">
      <header class="rx-header">
        <section class="doctor-side doctor-left"><strong>${t('doctor')} ${escapeHtml(doctorName)}</strong><div>${escapeHtml(doctor?.speciality || '')}</div>${doctor?.phoneNumber ? `<div>${t('phoneNumber')}: ${escapeHtml(doctor.phoneNumber)}</div>` : ''}${doctor?.email ? `<div>${t('email')}: ${escapeHtml(doctor.email)}</div>` : ''}</section>
        <div class="rx-emblem">${medicalEmblem}</div>
        <section class="doctor-side doctor-right" dir="rtl"><strong>الدكتور ${escapeHtml(doctorName)}</strong><div>التخصص ${escapeHtml(doctor?.speciality || '')}</div>${doctor?.phoneNumber ? `<div>الهاتف: ${escapeHtml(doctor.phoneNumber)}</div>` : ''}${doctor?.email ? `<div>${t('email')}: ${escapeHtml(doctor.email)}</div>` : ''}</section>
      </header>
      ${doctor?.hospitalName || doctor?.address || doctor?.professionalRegistrationNumber ? `<div class="clinic-line">${[doctor?.hospitalName, doctor?.address, doctor?.professionalRegistrationNumber ? `${t('professionalRegistrationNumber')}: ${doctor.professionalRegistrationNumber}` : ''].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join('<span class="separator">·</span>')}</div>` : ''}
      <div class="blue-rule"></div>
      ${customDocumentHeader ? `<p class="custom-head">${escapeHtml(customDocumentHeader)}</p>` : ''}
      <section class="patient-info"><p><strong>${t('date')} :</strong> ${dateLabel}</p><div class="patient-fields"><span><strong>${t('lastName')} :</strong> ${escapeHtml(printedPatientLastName)}</span><span><strong>${t('firstName')} :</strong> ${escapeHtml(printedPatientFirstName)}</span><span><strong>${t('age')} :</strong> ______</span></div></section>
      <h1>${escapeHtml(t('medicalPrescription'))}</h1>
      <section class="rx-body"><div class="watermark">${medicalEmblem}</div><div class="rx-content"><h2>${t('prescription')}</h2><ol>${currentPrescriptions.map((item) => `<li><strong>${escapeHtml(item.name)}</strong><div class="med-details">${item.dosage ? `<span><b>${t('dosage')}:</b> ${escapeHtml(displayPrescriptionValue(item.dosage, t))}</span>` : ''}${item.route ? `<span><b>${t('routeOfAdministration')}:</b> ${escapeHtml(displayPrescriptionValue(item.route, t))}</span>` : ''}${item.frequency ? `<span><b>${t('frequency')}:</b> ${escapeHtml(displayPrescriptionValue(item.frequency, t))}</span>` : ''}${item.duration ? `<span><b>${t('duration')}:</b> ${escapeHtml(displayPrescriptionValue(item.duration, t))}</span>` : ''}${item.quantity ? `<span><b>${t('quantity')}:</b> ${escapeHtml(item.quantity)}</span>` : ''}${item.instructions ? `<span><b>${t('instructions')}:</b> ${escapeHtml(item.instructions)}</span>` : ''}</div></li>`).join('')}</ol>${treatment.trim() ? `<h2>${t('recommendations')}</h2><p>${escapeHtml(treatment).replace(/\n/g, '<br>')}</p>` : ''}</div></section>
      ${customDocumentFooter ? `<div class="custom-footer">${escapeHtml(customDocumentFooter)}</div>` : ''}
      <footer class="rx-footer"><div class="blue-rule"></div><p>${[doctor?.hospitalName, doctor?.address, doctor?.phoneNumber].filter(Boolean).map(escapeHtml).join(' · ')}</p><small>${t('printSignatureNotice')}</small><div class="signature">${t('doctor')} · ${t('signatureAndStamp')}</div></footer>
    </main>`;
    const genericMarkup = `<main class="sheet"><header class="top"><div><strong>${t('doctor')} ${escapeHtml(doctorName)}</strong><div class="muted">${escapeHtml(doctor?.speciality || '')}</div>${doctorContact.map((line) => `<div class="contact">${escapeHtml(line)}</div>`).join('')}${customDocumentHeader ? `<p class="custom-head">${escapeHtml(customDocumentHeader)}</p>` : ''}</div><div>${t('date')}: ${dateLabel}</div></header><h1>${escapeHtml(titleByType[type])}</h1><p><strong>${t('patient')} :</strong> ${escapeHtml(patientName)}</p><p><strong>${t('date')} :</strong> ${dateLabel}</p><section class="body">${contentByType[type]}</section>${customDocumentFooter ? `<p class="custom-footer">${escapeHtml(customDocumentFooter)}</p>` : ''}<p class="notice">${t('printSignatureNotice')}</p><div class="signature"><div class="sign">${t('doctor')} · ${t('signatureAndStamp')}</div></div></main>`;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="${escapeHtml(document.documentElement.lang || 'fr')}"><head><meta charset="utf-8"><title>${escapeHtml(titleByType[type])} - ${escapeHtml(patientName)}</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:15px/1.5 Arial,sans-serif;color:#172b3a;margin:0;padding:28px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{max-width:760px;margin:0 auto}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #222;padding-bottom:18px}.muted{color:#555}.contact{font-size:12px;color:#444;margin-top:3px}.custom-head{font-weight:600;margin:14px 0 0;white-space:pre-line}.body{min-height:300px;padding:24px 0}.custom-footer{font-size:13px;white-space:pre-line;margin-top:20px}.notice{font-size:12px;color:#555;border:1px solid #aaa;padding:10px;margin-top:24px}.signature{display:flex;justify-content:flex-end;margin-top:70px}.sign{width:240px;border-top:1px solid #555;padding-top:8px;text-align:center}h1{font-size:24px}h2{font-size:17px;margin-top:24px}li{margin:8px 0}.rx-sheet{position:relative;display:flex;flex-direction:column;max-width:760px;min-height:270mm;margin:0 auto;padding:10px 20px;color:#176eaa}.rx-header{display:grid;grid-template-columns:minmax(0,1fr) 90px minmax(0,1fr);align-items:center;gap:16px;padding:8px 0 20px}.doctor-side{font-size:13px;line-height:1.8}.doctor-side strong{display:block;font-size:17px;margin-bottom:4px}.doctor-right{text-align:right}.rx-emblem{width:82px;height:82px;color:#1677b8}.rx-emblem svg{width:100%;height:100%}.clinic-line{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;color:#176eaa;font-size:12px;padding:8px 0}.separator{color:#62a6d2}.blue-rule{height:2px;background:#287ab2;width:100%}.rx-sheet .custom-head{margin:10px 0 0;text-align:center;color:#287ab2}.patient-info{padding:14px 0 6px;color:#176eaa}.patient-info p{margin:2px 0 10px}.patient-fields{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:16px}.rx-sheet h1{text-align:center;text-decoration:underline;font-size:22px;color:#1677b8;margin:12px 0 18px}.rx-body{position:relative;flex:1;min-height:100mm;padding:15px 10px}.watermark{position:absolute;inset:15% 0 auto;display:flex;justify-content:center;color:#c8f4f4;opacity:.55;pointer-events:none}.watermark svg{width:min(65%,380px);height:auto}.rx-content{position:relative;z-index:1;color:#172b3a}.rx-content h2{margin:6px 0 14px;color:#176eaa}.rx-content ol{padding-left:28px}.rx-content li{padding:8px 0 14px 4px}.med-details{display:grid;grid-template-columns:1fr 1fr;gap:3px 18px;margin:6px 0 0;font-size:13px}.rx-footer{margin-top:auto;color:#176eaa;text-align:center}.rx-footer p{margin:10px 0 4px;font-size:12px}.rx-footer small{display:block;color:#687d8b;font-size:10px;margin-top:9px}.rx-footer .signature{justify-content:flex-end;color:#334b5b;font-size:12px;margin:32px 8px 0}.custom-footer{color:#176eaa;text-align:center;white-space:pre-line;margin:12px 0}@media print{body{padding:0}.sheet{max-width:none;margin:20mm auto}.rx-sheet{max-width:none;min-height:273mm;margin:0;padding:0}.rx-body{min-height:0}}
    </style></head><body>${type === 'prescription' ? prescriptionMarkup : genericMarkup}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`);
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
        setAttachments(record?.attachments || []);
        setPatientProfile(data.patient ? { firstName: data.patient.firstName || '', lastName: data.patient.lastName || '' } : null);
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

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiFetch('http://localhost:3000/api/users/profile')
      .then(async (response) => response.ok ? response.json() : null)
      .then((profile) => { if (active && profile) setDoctorDocumentProfile(profile); })
      .catch(() => {});
    return () => { active = false; };
  }, [isOpen]);

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

  const uploadMedicalAttachment = async (file?: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setIsUploadingAttachment(true);
    try {
      const response = await apiFetch(`http://localhost:3000/api/patients/${patientId}/attachments`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('medicalAttachmentUploadError'));
      setAttachments((items) => [data.attachment, ...items]);
      toast.success(t('medicalAttachmentUploaded'));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const downloadMedicalAttachment = async (attachment: MedicalAttachment) => {
    try {
      const response = await apiFetch(`http://localhost:3000/api/patients/${patientId}/attachments/${attachment._id}`);
      if (!response.ok) throw new Error(t('medicalAttachmentDownloadError'));
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const deleteMedicalAttachment = async (attachment: MedicalAttachment) => {
    try {
      const response = await apiFetch(`http://localhost:3000/api/patients/${patientId}/attachments/${attachment._id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('medicalAttachmentDeleteError'));
      setAttachments((items) => items.filter((item) => item._id !== attachment._id));
      toast.success(t('medicalAttachmentDeleted'));
    } catch (error) {
      toast.error((error as Error).message);
    }
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold"><Paperclip className="h-5 w-5 text-indigo-600" />{t('medicalAttachments')}</h3>
                  <p className="mt-1 text-xs text-slate-500">{t('medicalAttachmentsHelp')}</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  <Upload className="h-4 w-4" />{isUploadingAttachment ? t('uploading') : t('addMedicalAttachment')}
                  <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={isUploadingAttachment} className="sr-only" onChange={(event) => { void uploadMedicalAttachment(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                </label>
              </div>
              {attachments.length ? <ul className="mt-3 divide-y rounded-xl border dark:divide-slate-800 dark:border-slate-700">
                {attachments.map((attachment) => <li key={attachment._id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{attachment.fileName}</p><p className="text-xs text-slate-500">{(attachment.size / 1024).toFixed(0)} Ko · {format(new Date(attachment.uploadedAt), 'dd/MM/yyyy', { locale: fr })}</p></div>
                  <div className="flex shrink-0 gap-1"><button type="button" onClick={() => void downloadMedicalAttachment(attachment)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800" aria-label={`${t('download')} ${attachment.fileName}`}><Download className="h-4 w-4" /></button><button type="button" onClick={() => void deleteMedicalAttachment(attachment)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-slate-800" aria-label={`${t('delete')} ${attachment.fileName}`}><Trash2 className="h-4 w-4" /></button></div>
                </li>)}
              </ul> : <p className="mt-3 rounded-xl border border-dashed p-4 text-center text-sm text-slate-500 dark:border-slate-700">{t('noMedicalAttachments')}</p>}
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
