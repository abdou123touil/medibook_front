import React from 'react';
import { FileText, Activity, Pill, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MedicalRecord {
  id: string;
  date: string;
  type: 'consultation' | 'prescription' | 'test';
  doctor: string;
  description: string;
  documents?: string[];
}

interface MedicalHistoryProps {
  records: MedicalRecord[];
}

export function MedicalHistory({ records }: MedicalHistoryProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <FileText className="w-6 h-6 text-indigo-600" />
        {t('medicalHistoryTitle')}
      </h2>

      <div className="space-y-6 ">
        {records.map((record) => (
          <div
            key={record.id}
            className="border-l-4 border-indigo-600 pl-4 py-2"
          >
            <div className="flex items-start justify-between mb-2 ">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {record.type === 'consultation' && (
                    <Activity className="w-4 h-4 text-indigo-600 dark:text-gray-100" />
                  )}
                  {record.type === 'prescription' && (
                    <Pill className="w-4 h-4 text-green-600 dark:text-gray-100" />
                  )}
                  {record.type === 'test' && (
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-gray-100" />
                  )}
                  {record.doctor}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-100">{record.date}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-2 whitespace-pre-line dark:text-gray-100">
              {record.description || t('noDetailsAdded')}
            </p>
            {record.documents && record.documents.length > 0 && (
              <div className="flex gap-2 dark:text-gray-100">
                {record.documents.map((doc, index) => (
                  <a
                    key={index}
                    href="#"
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 dark:text-gray-100"
                  >
                    <FileText className="w-4 h-4" />
                    {t('documentNumber', { number: index + 1 })}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {records.length === 0 && <p className="text-sm text-gray-500">{t('noMedicalHistory')}</p>}
      </div>
    </div>
  );
}
