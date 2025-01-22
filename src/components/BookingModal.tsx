import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Calendar } from './Calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Doctor } from '../types';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor;
}

export function BookingModal({ isOpen, onClose, doctor }: BookingModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState('');

  const handleBookAppointment = async () => {
    if (!doctor) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}'); // Récupérer l'utilisateur connecté
    const token = localStorage.getItem('token'); // Authentification
    const patientId = user?.data?.id;

    if (!selectedTime || !symptoms.trim()) {
      alert("Veuillez sélectionner une heure et renseigner vos symptômes.");
      return;
    }

    const formattedDate = selectedDate.toISOString().split('T')[0];
    console.log(doctor._id)
    try {
      const response = await fetch('http://localhost:3000/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: doctor._id, // Correction ici
          patientId,
          date: formattedDate,
          time: selectedTime,
          symptoms,
        }),
        
      });
     
      if (!response.ok) {
        throw new Error('Erreur lors de la prise de rendez-vous.');
        
      }

      const data = await response.json();
      console.log('Rendez-vous créé:', data);

      alert('Rendez-vous confirmé avec succès !');
      onClose(); // Ferme le modal après enregistrement
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleBookAppointment();
  };

  if (!isOpen) return null;

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const availableSlots = doctor.availability?.[formattedDate] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-6">
          Prendre rendez-vous avec Dr. {doctor.lastName}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sélection de la date */}
          <Calendar
            selectedDate={selectedDate}
            availableSlots={availableSlots}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setSelectedTime(null);
            }}
            onTimeSelect={setSelectedTime}
            selectedTime={selectedTime}
          />

          {/* Symptômes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Symptômes ou raison de la consultation
            </label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={4}
              required
            />
          </div>

          {/* Bouton de confirmation */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!selectedTime}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer le rendez-vous
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
