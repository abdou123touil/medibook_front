import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Calendar, Clock, Stethoscope, ArrowUpRight, X } from "lucide-react";
import { BookingModal } from "../components/BookingModal";
import { ReviewModal } from "../components/ReviewModal";
import DoctorSkeleton from "../components/DoctorSkeleton"; // Import du Skeleton
import { useTranslation } from "react-i18next";

const specialties = [
  { value: "Dentiste", key: "specialtyDentist" }, { value: "Generaliste", key: "specialtyGeneralPractitioner" },
  { value: "Cardiologue", key: "specialtyCardiologist" }, { value: "Dermatologue", key: "specialtyDermatologist" },
  { value: "Pédiatre", key: "specialtyPediatrician" }, { value: "Ophtalmologue", key: "specialtyOphthalmologist" },
  { value: "Orthopédiste", key: "specialtyOrthopedist" }, { value: "ORL", key: "specialtyEnt" },
];
const specialtyKeys: Record<string, string> = Object.fromEntries(specialties.map((item) => [item.value.toLowerCase(), item.key]));

interface Doctor {
  id: string;
  _id?: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  speciality: string;
  description: string;
  availability: Record<string, string[]>;
}

export function ClientDashboard() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
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
    let active = true;
    const fetchDoctors = async () => {
      try {
        const response = await apiFetch("http://localhost:3000/api/users/doctors");
        if (!response.ok) {
          throw new Error(t("errorLoadDoctors"));
        }
        const data = await response.json();
        if (!active) return;
        setDoctors(Array.isArray(data) ? data : []);
        setError(null);
      } catch {
        if (!active) return;
        if (doctors.length === 0) setError(t("errorLoadDoctors"));
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchDoctors();
    const intervalId = window.setInterval(fetchDoctors, 5000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchDoctors();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [t]);

  useEffect(() => {
    if (loading) return;
    const rebookDoctorId = (location.state as { rebookDoctorId?: string } | null)?.rebookDoctorId;
    if (!rebookDoctorId) return;

    const doctorToRebook = doctors.find((doctor: Doctor & { _id?: string }) =>
      doctor._id === rebookDoctorId || doctor.id === rebookDoctorId
    );
    if (doctorToRebook) {
      setSelectedDoctor(doctorToRebook);
      setIsBookingModalOpen(true);
    } else {
      setError(t('doctorNotFound'));
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [doctors, loading, location.pathname, location.state, navigate, t]);

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
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8" dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-600 p-6 text-white shadow-xl shadow-emerald-900/10 sm:p-8">
          <div className="pointer-events-none absolute -end-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="hidden rounded-2xl bg-white/15 p-3 ring-1 ring-white/20 sm:inline-flex"><Stethoscope className="h-7 w-7" /></span>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">{t('homeSpecialistsTitle')}</p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('findDoctor')}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">{t('homeSubtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white/95 backdrop-blur-sm">
              <Calendar className="h-5 w-5 shrink-0" />
              <span>{t('bookAppointment')}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-6 lg:h-fit">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('specialties')}</h2>
              <span className="text-xs text-slate-400">{specialties.length + 1}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              <button
                type="button"
                onClick={() => setSelectedSpecialty('')}
                aria-pressed={!selectedSpecialty}
                className={`shrink-0 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition lg:w-full ${!selectedSpecialty ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >{t('allSpecialties')}</button>
              {specialties.map((specialty) => (
                <button
                  key={specialty.value}
                  type="button"
                  onClick={() => setSelectedSpecialty(specialty.value)}
                  aria-pressed={selectedSpecialty === specialty.value}
                  className={`shrink-0 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition lg:w-full ${selectedSpecialty === specialty.value ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >{t(specialty.key)}</button>
              ))}
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block min-w-0 flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    placeholder={t('searchDoctor')}
                    aria-label={t('searchDoctor')}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pe-10 ps-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label={t('close')} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><X className="h-4 w-4" /></button>}
                </label>
                <div className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Stethoscope className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold tabular-nums">{loading ? '—' : filteredDoctors.length}</span>
                  <span>{t('doctorResults', { count: filteredDoctors.length })}</span>
                </div>
              </div>
            </section>

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, index) => <DoctorSkeleton key={index} />)}</div>
            ) : filteredDoctors.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
                <Search className="mx-auto mb-4 h-10 w-10 text-slate-400" />
                <p className="mx-auto max-w-md text-slate-600 dark:text-slate-300">
                  {selectedSpecialty
                    ? t('noDoctorForSpecialty', { specialty: t(specialtyKeys[selectedSpecialty.toLowerCase()] || selectedSpecialty) })
                    : t('noDoctorFound')}
                </p>
                {(searchQuery || selectedSpecialty) && <button type="button" onClick={() => { setSearchQuery(''); setSelectedSpecialty(''); }} className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50">{t('allSpecialties')}</button>}
              </section>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredDoctors.map((doctor) => {
                  const slotCount = Object.entries(doctor.availability || {}).reduce((total, [date, slots]) => {
                    const today = new Date().toISOString().slice(0, 10);
                    return date >= today && Array.isArray(slots) ? total + slots.length : total;
                  }, 0);
                  return (
                    <article key={doctor._id || doctor.id} className="group flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-900 sm:p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-lg font-bold text-emerald-800 dark:from-emerald-950 dark:to-teal-950 dark:text-emerald-200">
                          {(doctor.firstName?.[0] || 'D').toUpperCase()}{(doctor.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-lg font-bold text-slate-900 dark:text-white">Dr. {doctor.firstName} {doctor.lastName}</h3>
                          <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">{t(specialtyKeys[doctor.speciality?.toLowerCase()] || doctor.speciality)}</span>
                        </div>
                      </div>
                      <p className="mt-4 min-h-[3.5rem] text-sm leading-6 text-slate-600 line-clamp-3 dark:text-slate-300">{doctor.description || t('notProvided')}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />{t('nextAvailableAppointment')}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />{slotCount} {t('availableSlots')}</span>
                      </div>
                      <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                        <button
                          type="button"
                          onClick={() => { setSelectedDoctor(doctor); setIsBookingModalOpen(true); }}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                        >{t('bookAppointment')}<ArrowUpRight className="h-4 w-4" /></button>
                        <button
                          type="button"
                          onClick={() => { setSelectedDoctorId(doctor._id || doctor.id); setIsReviewModalOpen(true); }}
                          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >{t('viewReviews')}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {selectedDoctor && (
        
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          doctor={selectedDoctor}
        />
      )}
      
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
           localStorage.removeItem(
                "cachedReactions");
          setIsReviewModalOpen(false);
          setSelectedDoctorId(null); // Reset selectedDoctorId when closing
        }}
        doctorId={selectedDoctorId ?? ""} // Ensure it's always a valid string
      />
    </div>
  );
}
