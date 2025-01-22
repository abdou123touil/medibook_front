import React, { useState, useEffect } from "react";
import { Search, Calendar, Clock } from "lucide-react";
import { BookingModal } from "../components/BookingModal";
import { ReviewModal } from "../components/ReviewModal";

const specialties = [
  "Dentiste",
  "Generaliste",
  "Cardiologue",
  "Dermatologue",
  "Pédiatre",
  "Ophtalmologue",
  "Orthopédiste",
  "ORL",
];

interface Doctor {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  speciality: string;
  description: string;
  availability: Record<string, string[]>;
}

export function ClientDashboard() {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/users/doctors"); // Remplacez par votre URL backend
        if (!response.ok) {
          throw new Error("Erreur lors de la récupération des médecins.");
        }
        const data = await response.json();
        setDoctors(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const handleBookAppointment = (appointment: {
    date: Date;
    time: string;
    symptoms: string;
  }) => {
    console.log("Booking appointment:", appointment);
    // TODO: Implémenter la logique de prise de RDV
  };

  const filteredDoctors = doctors.filter((doctor) => {
    const matchesSearch =
      doctor.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.lastName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSpecialty =
      !selectedSpecialty ||
      doctor.speciality.toLowerCase() === selectedSpecialty.toLowerCase();

    return matchesSearch && matchesSpecialty;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-12 gap-6">
        {/* Filtres */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Spécialités</h2>
            <div className="space-y-2">
              {specialties.map((specialty) => (
                <button
                  key={specialty}
                  onClick={() => setSelectedSpecialty(specialty)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    selectedSpecialty === specialty
                      ? "bg-indigo-100 text-indigo-700"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Liste des médecins */}
        <div className="md:col-span-9">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher un médecin..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <p className="text-center text-gray-500">
                Chargement des médecins...
              </p>
            ) : error ? (
              <p className="text-center text-red-500">{error}</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredDoctors.map((doctor) => (
                  <div
                    key={doctor._id}
                    className="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Dr. {doctor.lastName}
                        </h3>
                        <p className="text-indigo-600">{doctor.speciality}</p>
                        <p className="text-sm text-gray-600 mt-2">
                          {doctor.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        Prochain RDV disponible
                      </div>
                      <div className="flex items-center text-sm font-semibold text-indigo-600">
                        <Clock className="w-4 h-4 mr-1" />
                        Voir les disponibilités
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDoctor(doctor);
                        setIsBookingModalOpen(true);
                      }}
                      className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Prendre rendez-vous
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDoctorId(doctor._id);
                        setTimeout(() => setIsReviewModalOpen(true), 0); // Ensure state updates before modal renders
                      }}
                      className="w-full bg-gray-100 text-indigo-600 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Voir Avis
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedDoctor && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          doctor={selectedDoctor}
          onBookAppointment={handleBookAppointment}
        />
      )}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedDoctorId(null); // Reset selectedDoctorId when closing
        }}
        doctorId={selectedDoctorId ?? ""} // Ensure it's always a valid string
      />
    </div>
  );
}
