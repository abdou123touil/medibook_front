import React from 'react';
import { FileText, Download, Pill, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';

interface Prescription {
  id: string;
  date: string;
  doctor: string;
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
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
      const details = [medication.dosage, medication.frequency, medication.duration].filter(Boolean).join(' — ');
      document.text(`${index + 1}. ${medication.name}${details ? ` : ${details}` : ''}`, 18, y, { maxWidth: 175 });
      y += 10;
    });
    if (prescription.notes) {
      document.text(`${t('recommendations')}:`, 18, y + 4);
      document.text(document.splitTextToSize(prescription.notes, 175), 18, y + 12);
    }
    document.save(`ordonnance-${prescription.date.replaceAll('/', '-')}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Pill className="w-6 h-6 text-indigo-600" />
        {t('prescriptionsTitle')}
      </h2>

      <div className="space-y-6">
        {prescriptions.map((prescription) => (
          <div
            key={prescription.id}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Dr. {prescription.doctor}</h3>
                <div className="text-sm text-gray-500 flex items-center gap-1">
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
                <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg dark:bg-gray-600 dark:text-gray-100">
                  <Pill className="w-5 h-5 text-indigo-600 mt-1" />
                  <div>
                    <h4 className="font-medium">{med.name}</h4>
                    {(med.dosage || med.frequency) && (
                      <p className="text-sm text-gray-600">{[med.dosage, med.frequency].filter(Boolean).join(' - ')}</p>
                    )}
                    {med.duration && <p className="text-sm text-gray-500">{t('duration')}: {med.duration}</p>}
                  </div>
                </div>
              ))}
            </div>

            {prescription.notes && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">{t('notes')}</span>
                </div>
                <p className="text-sm text-yellow-800 mt-1">{prescription.notes}</p>
              </div>
            )}
          </div>
        ))}
        {prescriptions.length === 0 && <p className="text-sm text-gray-500">{t('noPrescriptions')}</p>}
      </div>
    </div>
  );
}
