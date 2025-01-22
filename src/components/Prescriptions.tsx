import React from 'react';
import { FileText, Download, Pills, Calendar } from 'lucide-react';

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
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Pills className="w-6 h-6 text-indigo-600" />
        Ordonnances
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
              <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full">
                <Download className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {prescription.medications.map((med, index) => (
                <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                  <Pills className="w-5 h-5 text-indigo-600 mt-1" />
                  <div>
                    <h4 className="font-medium">{med.name}</h4>
                    <p className="text-sm text-gray-600">
                      {med.dosage} - {med.frequency}
                    </p>
                    <p className="text-sm text-gray-500">Durée: {med.duration}</p>
                  </div>
                </div>
              ))}
            </div>

            {prescription.notes && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">Notes</span>
                </div>
                <p className="text-sm text-yellow-800 mt-1">{prescription.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}