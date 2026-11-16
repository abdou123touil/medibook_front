import React from 'react';
import { FileText, Download, Pill, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';
import { displayPrescriptionValue } from '../lib/prescriptions';

interface Prescription {
  id: string;
  date: string;
  doctor: string;
  medications: {
    name: string;
    dosage: string;
    route?: string;
    frequency: string;
    duration: string;
    quantity?: string;
    instructions?: string;
  }[];
  notes?: string;
}

interface PrescriptionsProps {
  prescriptions: Prescription[];
}

export function Prescriptions({ prescriptions }: PrescriptionsProps) {
  const { t } = useTranslation();
  const downloadPrescription = (prescription: Prescription) => {
    const document = new jsPDF();
    document.setFontSize(18);
    document.text(t('medicalPrescription'), 18, 20);
    document.setFontSize(11);
    document.text(`${t('doctor')}: Dr. ${prescription.doctor}`, 18, 32);
    document.text(`${t('date')}: ${prescription.date}`, 18, 40);
    let y = 54;
    prescription.medications.forEach((medication, index) => {
      const details = [medication.dosage, medication.route, medication.frequency, medication.duration, medication.quantity]
        .filter(Boolean).map((value) => displayPrescriptionValue(value, t)).join(' — ');
      document.text(`${index + 1}. ${medication.name}${details ? ` : ${details}` : ''}`, 18, y, { maxWidth: 175 });
      y += 10;
      if (medication.instructions) {
        document.text(document.splitTextToSize(`${t('instructions')}: ${medication.instructions}`, 165), 25, y);
        y += 8;
      }
    });
    if (prescription.notes) {
      document.text(`${t('recommendations')}:`, 18, y + 4);
      document.text(document.splitTextToSize(prescription.notes, 175), 18, y + 12);
    }
    document.save(`ordonnance-${prescription.date.replaceAll('/', '-')}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Pill className="w-6 h-6 text-indigo-600" />
        {t('prescriptionsTitle')}
      </h2>

      <div className="space-y-6">
        {prescriptions.map((prescription) => (
          <div
            key={prescription.id}
            className="border rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Dr. {prescription.doctor}</h3>
                <div className="text-sm text-slate-500 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {prescription.date}
                </div>
              </div>
              <button type="button" onClick={() => downloadPrescription(prescription)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full" aria-label={t('downloadPrescription')}>
                <Download className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {prescription.medications.map((med, index) => (
                <div key={index} className="flex items-start gap-3 p-2 bg-slate-50 rounded-xl dark:bg-slate-700 dark:text-slate-100">
                  <Pill className="w-5 h-5 text-indigo-600 mt-1" />
                  <div>
                    <h4 className="font-medium">{med.name}</h4>
                    {(med.dosage || med.route || med.frequency) && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">{[med.dosage, med.route, med.frequency].filter(Boolean).map((value) => displayPrescriptionValue(value, t)).join(' - ')}</p>
                    )}
                    {med.duration && <p className="text-sm text-slate-500">{t('duration')}: {displayPrescriptionValue(med.duration, t)}</p>}
                    {med.quantity && <p className="text-sm text-slate-500">{t('quantity')}: {med.quantity}</p>}
                    {med.instructions && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('instructions')}: {med.instructions}</p>}
                  </div>
                </div>
              ))}
            </div>

            {prescription.notes && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-xl">
                <div className="flex items-center gap-2 text-yellow-800">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">{t('notes')}</span>
                </div>
                <p className="text-sm text-yellow-800 mt-1">{prescription.notes}</p>
              </div>
            )}
          </div>
        ))}
        {prescriptions.length === 0 && <p className="text-sm text-slate-500">{t('noPrescriptions')}</p>}
      </div>
    </div>
  );
}
