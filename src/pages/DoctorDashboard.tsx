import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { addDays, isWithinInterval, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
} from "lucide-react";
import { Appointment } from "../types";
import { AvailabilityManager } from "../components/AvailabilityManager";
import { useAuthStore } from "../store/auth";
import { fr } from "date-fns/locale";

export function DoctorDashboard() {
  const { user } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [historicAppointments, setHistoricAppointments] = useState<
    Appointment[]
  >([]);
  const [availability, setAvailability] = useState<{
    [date: string]: string[];
  }>({});
  const [availableSlotsIn14Days, setAvailableSlotsIn14Days] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const today = new Date();
  const futureDate = addDays(today, 14);
  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const doctorId = user?.data?.id;
      if (!doctorId) {
        throw new Error("ID du médecin non trouvé.");
      }

      // Fetch next (upcoming) appointments
      const upcomingResponse = await fetch(
        `http://localhost:3000/api/appointments/doctor/${doctorId}/next`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const upcomingData = await upcomingResponse.json();
      if (!upcomingResponse.ok) {
        console.log("Failed to fetch upcoming appointments", upcomingData);
        throw new Error(
          "Erreur lors de la récupération des prochains rendez-vous."
        );
      }

      // Fetch all appointments (to get cancelled/completed)
      const historicResponse = await fetch(
        `http://localhost:3000/api/appointments/doctor/${doctorId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const historicData = await historicResponse.json();
      if (!historicResponse.ok) {
        console.log("Failed to fetch historic appointments", historicData);
        throw new Error(
          "Erreur lors de la récupération des rendez-vous historiques."
        );
      }

      // Filter only completed or cancelled appointments
      const historicFiltered = historicData.filter(
        (apt: Appointment) =>
          apt.status === "completed" || apt.status === "cancelled"
      );

      // Update states
      setAppointments(upcomingData); // Only upcoming
      setHistoricAppointments(historicFiltered); // Only cancelled/completed
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: "completed" | "cancelled"
  ) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:3000/api/appointments/${appointmentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        throw new Error("Erreur lors de la mise à jour du rendez-vous");
      }

      // Find the updated appointment and add it to historic appointments
      const updatedAppointment = appointments.find(
        (apt) => apt._id === appointmentId
      );

      if (updatedAppointment) {
        // Add to historic appointments based on status
        setHistoricAppointments((prevHistoricAppointments) => [
          ...prevHistoricAppointments,
          { ...updatedAppointment, status },
        ]);
      }

      // Update the appointment in the current list
      setAppointments((prevAppointments) =>
        prevAppointments.filter((apt) => apt._id !== appointmentId)
      );
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const openHistoricModal = () => {
    setIsModalOpen(true);
  };

  const closeHistoricModal = () => {
    setIsModalOpen(false);
  };
  const fetchAvailability = async () => {
    try {
      const token = localStorage.getItem("token");
      
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      
      const doctorId = storedUser?.data?.id;
      if (!doctorId) {
        throw new Error("ID du médecin non trouvé.");
      }

      const response = await fetch(
        `http://localhost:3000/api/users/get-availability?userId=${doctorId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        console.error(
          "Erreur lors de la récupération des disponibilités",
          data
        );
        return;
      }

      setAvailability(data.availability);
      // **Calculate available slots in the next 14 days**
      let slotsCount = 0;
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 14);
     

      const currentTime = format(today, "HH:mm");

      Object.entries(data.availability).forEach(([date, times]) => {
        const dateObj = parseISO(date);

   

        if (isWithinInterval(dateObj, { start: today, end: futureDate })) {
          // If it's today, only count future time slots
          const validTimes =
            date === format(today, "yyyy-MM-dd")
              ? times.filter((time) => time > currentTime)
              : times;


          slotsCount += validTimes.length;
        }
      });

      setAvailableSlotsIn14Days(slotsCount);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchAvailability();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Tableau de Bord Médecin
          </h1>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="bg-indigo-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Rendez-vous du jour
              </h2>
              <div className="text-2xl font-bold text-indigo-600">
                {appointments.filter((apt) => apt.status === "pending").length}
              </div>
              <p className="text-gray-600">rendez-vous en attente</p>
            </div>

            <div className="bg-green-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Consultations terminées
              </h2>
              <div className="text-2xl font-bold text-green-600">
                {
                  historicAppointments.filter(
                    (apt) => apt.status === "completed"
                  ).length
                }
              </div>
              <p className="text-gray-600">cette semaine</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Créneaux disponibles
              </h2>
              <div className="text-2xl font-bold text-blue-600">
                {availableSlotsIn14Days}
              </div>
              <p className="text-gray-600">sur les 14 prochains jours</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Prochains Rendez-vous
            </h2>
            <div className="space-y-4">
              {appointments
                .filter((appointment) => appointment.status === "pending")
                .map((appointment) => (
                  <div
                    key={appointment.id}
                    className="bg-white rounded-lg p-4 shadow-sm border"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">
                          Patient:{" "}
                          {appointment.patientId?.firstName ||
                            "Nom non disponible"}{" "}
                          {appointment.patientId?.lastName ||
                            "Prénom non disponible"}
                        </h3>

                        <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(appointment.date), "PPP", {
                            locale: fr,
                          })}{" "}
                          à {appointment.time}
                        </div>
                        <p className="mt-2 text-gray-700">
                          {appointment.symptoms}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateAppointmentStatus(
                              appointment._id,
                              "completed"
                            )
                          }
                          className="p-2 text-green-600 hover:bg-green-50 rounded-full"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() =>
                            updateAppointmentStatus(
                              appointment._id,
                              "cancelled"
                            )
                          }
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <button
              onClick={openHistoricModal}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full"
            >
              Historique
            </button>
          </div>

          <div>
            <AvailabilityManager onUpdateAvailability={setAvailability} />
          </div>
        </div>
      </div>

      {/* Historic Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex justify-center items-center">
          <div className="bg-white rounded-lg p-6 max-h-96 overflow-y-auto w-96 relative scrollbar-thin">
            <button
              onClick={closeHistoricModal}
              className="absolute top-2 right-2 text-gray-500"
            >
              X
            </button>
            <h2 className="text-xl font-semibold mb-4">
              Historique des Rendez-vous
            </h2>
            <div className="space-y-4">
              {historicAppointments.map((appointment) => (
                <div
                  key={appointment._id}
                  className={`rounded-lg p-4 shadow-sm border ${
                    appointment.status === "cancelled"
                      ? "bg-red-100 border-red-500"
                      : "bg-green-100 border-green-500"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">
                        Patient:{" "}
                        {appointment.patientId?.firstName ||
                          "Nom non disponible"}{" "}
                        {appointment.patientId?.lastName ||
                          "Prénom non disponible"}
                      </h3>
                      <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4" />
                        {format(new Date(appointment.date), "PPP", {
                          locale: fr,
                        })}{" "}
                        à {appointment.time}
                      </div>
                      <p className="mt-2 text-gray-700">
                        {appointment.symptoms}
                      </p>
                      <p className="mt-2 text-gray-700">{appointment.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
