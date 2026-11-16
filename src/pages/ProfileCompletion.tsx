import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building, FileText, MapPin, Upload, User } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Map } from "../components/Map";
import { useAuthStore } from "../store/auth";

type ImageField = "profileImage" | "cinFront" | "cinBack";
const initialLocation = { lat: 33.5731, lng: -7.5898 };

export function ProfileCompletion() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pendingRegistration: registration, setPendingRegistration, setUser, setToken } = useAuthStore();
  const role = registration?.role;
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationSelected, setLocationSelected] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    firstName: "", lastName: "", cinNumber: "", address: "", speciality: "", hospital: "",
    location: initialLocation,
    profileImage: null as File | null, profilePreview: "",
    cinFront: null as File | null, cinFrontPreview: "",
    cinBack: null as File | null, cinBackPreview: "",
  });
  const finalStep = role === "doctor" ? 3 : 2;

  const update = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>, field: ImageField) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("invalidImage"));
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("imageTooLarge"));
      event.target.value = "";
      return;
    }
    const previewField = field === "profileImage" ? "profilePreview" : `${field}Preview`;
    setForm((current) => ({ ...current, [field]: file, [previewField]: URL.createObjectURL(file) }));
  };

  const validateCurrentStep = () => {
    const nextErrors: Record<string, string> = {};
    if (step === 1) {
      if (form.firstName.trim().length < 2) nextErrors.firstName = t('firstNameValidation');
      if (form.lastName.trim().length < 2) nextErrors.lastName = t('lastNameValidation');
      if (form.cinNumber.trim().length < 4) nextErrors.cinNumber = t('cinValidation');
    } else if (step === 2) {
      if (form.address.trim().length < 5) nextErrors.address = t('addressValidation');
    } else {
      if (!form.speciality) nextErrors.speciality = t('specialtyValidation');
      if (form.hospital.trim().length < 3) nextErrors.hospital = t('clinicValidation');
    }
    if (step === 2 && !locationSelected) nextErrors.location = "Cliquez sur la carte pour choisir votre emplacement.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registration?.email || !registration.password || !role) {
      toast.error(t("registrationExpired"));
      navigate("/", { replace: true });
      return;
    }
    if (!validateCurrentStep()) return;
    if (step < finalStep) {
      setStep((current) => current + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      const body = new FormData();
      body.append("firstName", form.firstName.trim());
      body.append("lastName", form.lastName.trim());
      body.append("cinNumber", form.cinNumber.trim());
      body.append("address", form.address.trim());
      body.append("lat", String(form.location.lat));
      body.append("lng", String(form.location.lng));
      body.append("email", registration.email.trim());
      body.append("password", registration.password);
      body.append("role", role);
      if (form.profileImage) body.append("profileImage", form.profileImage);
      if (form.cinFront) body.append("cinFront", form.cinFront);
      if (form.cinBack) body.append("cinBack", form.cinBack);
      if (role === "doctor") {
        body.append("speciality", form.speciality);
        body.append("hospitalName", form.hospital.trim());
        body.append("availability", JSON.stringify({}));
      }

      const response = await fetch("http://localhost:3000/api/users/register", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("registrationFailed"));
      const sessionUser = { data: result.user };
      setUser(sessionUser);
      setToken(result.token);
      setPendingRegistration(null);
      localStorage.setItem("user", JSON.stringify(sessionUser));
      toast.success(t("accountCreated"));
      navigate(role === "doctor" ? "/doctor" : "/client", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("registrationFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!registration?.email || !registration.password || !role) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-16">
        <section className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow dark:bg-gray-800">
          <h1 className="text-2xl font-bold">{t("interruptedRegistration")}</h1>
          <p className="my-4 text-gray-600 dark:text-gray-300">{t("registrationInterruptedHelp")}</p>
          <button onClick={() => { setPendingRegistration(null); navigate("/"); }} className="rounded-lg bg-indigo-600 px-5 py-2 text-white">{t("restartRegistration")}</button>
        </section>
      </main>
    );
  }

  const setLocation = (lat: number, lng: number) => {
    setForm((current) => ({ ...current, location: { lat, lng } }));
    setLocationSelected(true);
    setErrors((current) => ({ ...current, location: "" }));
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-900">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-lg dark:bg-gray-800 sm:p-8">
        <header className="mb-6">
          <p className="text-sm font-medium text-indigo-600">{t("stepOf", { step, total: finalStep })}</p>
          <h1 className="mt-1 text-2xl font-bold">{t("profileCompletion")}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {step === 1 ? t("personalInformation") : step === 2 ? t("addressAndLocation") : t("professionalInformation")}
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {step === 1 && <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">{t("firstName")}
                <input autoComplete="given-name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-900" />
                {errors.firstName && <span className="text-red-600">{errors.firstName}</span>}
              </label>
              <label className="block text-sm font-medium">{t("lastName")}
                <input autoComplete="family-name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-900" />
                {errors.lastName && <span className="text-red-600">{errors.lastName}</span>}
              </label>
            </div>
            <label className="block text-sm font-medium">{t("cinNumber")}
              <input value={form.cinNumber} onChange={(e) => update("cinNumber", e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-900" />
              {errors.cinNumber && <span className="text-red-600">{errors.cinNumber}</span>}
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
              {form.profilePreview ? <img src={form.profilePreview} alt="Aperçu du profil" className="h-12 w-12 rounded-full object-cover" /> : <User className="h-8 w-8" />}
              <span><Upload className="mr-1 inline h-4 w-4" />{t("profilePhotoOptional")}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(e, "profileImage")} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["cinFront", "cinBack"] as const).map((field) => (
                <label key={field} className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-3 text-sm">
                  {form[`${field}Preview`] ? <img src={form[`${field}Preview`]} alt={field === "cinFront" ? "Aperçu CIN recto" : "Aperçu CIN verso"} className="mb-2 max-h-20 object-contain" /> : <FileText className="mb-1 h-6 w-6" />}
                  {field === "cinFront" ? t("cinFrontOptional") : t("cinBackOptional")}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(e, field)} />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">{t("imageLimit")}</p>
          </div>}

          {step === 2 && <div className="space-y-4">
            <label className="block text-sm font-medium">{t("fullAddress")}
              <span className="relative mt-1 block"><MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input autoComplete="street-address" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder={t("addressPlaceholder")} className="w-full rounded-lg border py-2 pl-9 pr-3 text-gray-900" />
              </span>
              {errors.address && <span className="text-red-600">{errors.address}</span>}
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("selectLocation")}</p>
            <div className="h-72 overflow-hidden rounded-lg"><Map onLocationSelect={setLocation} initialPosition={[form.location.lat, form.location.lng]} /></div>
            {locationSelected && <p className="text-sm text-green-700">{t("locationSelected")}</p>}
            {errors.location && <p className="text-sm text-red-600">{errors.location}</p>}
          </div>}

          {step === 3 && role === "doctor" && <div className="space-y-4">
            <label className="block text-sm font-medium">{t("specialty")}
              <select value={form.speciality} onChange={(e) => update("speciality", e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-900">
                <option value="">{t("selectSpecialty")}</option>
                <option value="generaliste">{t('specialtyGeneralPractitioner')}</option><option value="cardiologue">{t('specialtyCardiologist')}</option>
                <option value="dermatologue">{t('specialtyDermatologist')}</option><option value="pediatre">{t('specialtyPediatrician')}</option>
                <option value="psychiatre">{t('specialtyPsychiatrist')}</option><option value="ophtalmologue">{t('specialtyOphthalmologist')}</option>
              </select>{errors.speciality && <span className="text-red-600">{errors.speciality}</span>}
            </label>
            <label className="block text-sm font-medium">{t("clinicName")}
              <span className="relative mt-1 block"><Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input value={form.hospital} onChange={(e) => update("hospital", e.target.value)} className="w-full rounded-lg border py-2 pl-9 pr-3 text-gray-900" />
              </span>{errors.hospital && <span className="text-red-600">{errors.hospital}</span>}
            </label>
          </div>}

          <footer className="flex justify-between border-t pt-4">
            <button type="button" onClick={() => { if (step === 1) { setPendingRegistration(null); navigate("/"); } else setStep((current) => current - 1); }} className="rounded-lg bg-gray-200 px-4 py-2 text-gray-800">
              {step === 1 ? t("cancel") : t("previous")}
            </button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white disabled:opacity-60">
              {isSubmitting ? t("creatingAccount") : step === finalStep ? t("createAccount") : t("continue")}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}
