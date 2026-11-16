import React, { useState, useEffect } from 'react';
import { apiFetch } from "../lib/api";
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { UserCircle, MapPin, Briefcase, Lock, FileText, Bell } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';

interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;
  address: string;
  role: 'client' | 'doctor';
  speciality?: string;
  hospitalName?: string;
  professionalRegistrationNumber?: string;
  documentHeader?: string;
  documentFooter?: string;
  profileImage?: string;
  doctorLogo?: string | null;
  doctorLogoMimeType?: string | null;
  lat?: number;
  lng?: number;
  reminderPreferences?: { inAppEnabled: boolean; emailEnabled: boolean; before24h: boolean; before2h: boolean };
}

const defaultReminderPreferences = { inAppEnabled: true, emailEnabled: true, before24h: true, before2h: true };

const specialities = [
  'Cardiologie',
  'Pédiatrie',
  'Dermatologie',
  'Neurologie',
  'Chirurgie générale',
  'Ophtalmologie',
  'Orthopédie',
  'Gynécologie',
  'Psychiatrie',
  'Médecine générale',
];

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const defaultCenter = {
  lat: 48.8566, // Paris
  lng: 2.3522,
};

// Composant pour gérer le clic sur la carte
const MapClickHandler: React.FC<{ onClick: (lat: number, lng: number) => void }> = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export function Profile() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reminderPreferences, setReminderPreferences] = useState(defaultReminderPreferences);
  const [savingReminderPreferences, setSavingReminderPreferences] = useState(false);
  const [spes, setSpes] = useState<string[]>(specialities);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmNewPassword: '',
    oldPassword: '', // Pour le modal
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    address: '',
    speciality: '',
    hospitalName: '',
    professionalRegistrationNumber: '',
    documentHeader: '',
    documentFooter: '',
    profileImage: null as File | null,
    doctorLogo: null as File | null,
    doctorLogoPreview: '',
    lat: defaultCenter.lat,
    lng: defaultCenter.lng,
  });
  const [loading, setLoading] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const navigate = useNavigate();

  // Fetch profile data and get current location
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await apiFetch('http://localhost:3000/api/users/profile', {
          headers: {
          },
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la récupération du profil.');
        }

        const data = await response.json();
        
        setSpes(data.specialities || []);
        setProfile(data);
        setReminderPreferences({ ...defaultReminderPreferences, ...(data.reminderPreferences || {}) });
        setFormData({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumber: data.phoneNumber,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().slice(0, 10) : '',
          address: data.address,
          speciality: data.speciality || '',
          hospitalName: data.hospitalName || '',
          professionalRegistrationNumber: data.professionalRegistrationNumber || '',
          documentHeader: data.documentHeader || '',
          documentFooter: data.documentFooter || '',
          profileImage: null,
          doctorLogo: null,
          doctorLogoPreview: data.doctorLogo ? `data:${data.doctorLogoMimeType || 'image/png'};base64,${data.doctorLogo}` : '',
          lat: data.location?.lat || defaultCenter.lat,
          lng: data.location?.lng || defaultCenter.lng,
        });
      } catch (error) {
        
          toast.error(t('profileLoadError'));
      }
    };

    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }));
        },
        (error) => {
          
          toast.error(t('locationUnavailable'));
        }
      );
    } else {
      
    }

    fetchProfile();
  }, []);

  // Handle password input changes
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, profileImage: e.target.files![0] }));
    }
  };

  const handleDoctorLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error(t(file.size > 2 * 1024 * 1024 ? 'imageTooLarge' : 'invalidImage'));
      e.target.value = '';
      return;
    }
    setFormData((current) => ({ ...current, doctorLogo: file, doctorLogoPreview: URL.createObjectURL(file) }));
  };

  // Handle map click to update lat/lng
  const handleMapClick = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, lat, lng }));
  };

  // Handle password verification and update
  const handlePasswordVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);

    // Validate new password and confirmation
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      toast.error(t('passwordsDoNotMatch'));
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error(t('passwordMinimumLength'));
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await apiFetch('http://localhost:3000/api/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la réinitialisation du mot de passe.');
      }

      toast.success(t('passwordChanged'));
      setIsPasswordVerified(true);
      setPasswordData({ newPassword: '', confirmNewPassword: '', oldPassword: '' });
      setIsPasswordModalOpen(false);
    } catch (error) {
      
      toast.error((error as Error).message || t('errorTryAgain'));
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const compactPhone = formData.phoneNumber.trim().replace(/[\s().-]/g, '');
    if (!/^\+?\d{8,15}$/.test(compactPhone)) {
      toast.error(t('phoneValidation'));
      return;
    }
    if (profile?.role === 'client' && (!formData.dateOfBirth || formData.dateOfBirth > new Date().toISOString().slice(0, 10))) {
      toast.error(t('birthDateValidation'));
      return;
    }

    // Check if password fields are filled
    if (passwordData.newPassword || passwordData.confirmNewPassword) {
      if (!isPasswordVerified) {
        setIsPasswordModalOpen(true);
        return;
      }
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('firstName', formData.firstName);
      formDataToSend.append('lastName', formData.lastName);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phoneNumber', formData.phoneNumber);
      if (profile?.role === 'client') formDataToSend.append('dateOfBirth', formData.dateOfBirth);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('lat', formData.lat.toString());
      formDataToSend.append('lng', formData.lng.toString());
      if (profile?.role === 'doctor') {
        formDataToSend.append('speciality', formData.speciality);
        formDataToSend.append('hospitalName', formData.hospitalName);
        formDataToSend.append('professionalRegistrationNumber', formData.professionalRegistrationNumber);
        formDataToSend.append('documentHeader', formData.documentHeader);
        formDataToSend.append('documentFooter', formData.documentFooter);
      }
      if (formData.profileImage) {
        formDataToSend.append('profileImage', formData.profileImage);
      }
      if (profile?.role === 'doctor' && formData.doctorLogo) formDataToSend.append('doctorLogo', formData.doctorLogo);

      

      const response = await apiFetch('http://localhost:3000/api/users/profile', {
        method: 'PUT',
        headers: {
        },
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la mise à jour du profil.');
      }

      const data = await response.json();
      setProfile(data.user);
      setIsPasswordVerified(false); // Reset verification after saving
      toast.success(t('profileUpdated'));
    } catch (error) {
      
      toast.error((error as Error).message || t('errorTryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const saveReminderPreferences = async () => {
    setSavingReminderPreferences(true);
    try {
      const response = await apiFetch('http://localhost:3000/api/users/reminder-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderPreferences }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('reminderPreferencesSaveError'));
      setReminderPreferences({ ...defaultReminderPreferences, ...data.reminderPreferences });
      toast.success(t('reminderPreferencesSaved'));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingReminderPreferences(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-800">
        <div className="text-xl font-semibold text-gray-600 dark:text-gray-300">{t('loading')}</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gray-100 dark:bg-gray-800 py-10"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header with Profile Picture and Name */}
        <div className="bg-white dark:bg-gray-900 rounded-t-xl shadow-lg p-6 flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-700">
              {profile.profileImage ? (
                <img
                  src={`data:image/jpeg;base64,${profile.profileImage}`}
                  alt={t('profilePhoto')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle className="w-20 h-20 text-gray-400" />
              )}
            </div>
            <label
              htmlFor="profileImage"
              className="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-2 cursor-pointer hover:bg-indigo-700"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              <input
                type="file"
                id="profileImage"
                name="profileImage"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {profile.role === 'doctor' ? t('doctor') : t('client')}
          </p>
        </div>

        {/* Form Sections */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-b-xl shadow-lg p-6 space-y-6">
          {/* Personal Information Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
              <UserCircle className="w-6 h-6 text-indigo-600" />
              {t('personalInformation')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('firstName')}
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('lastName')}
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('phoneNumber')}
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>
              {profile.role === 'client' && <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dateOfBirth')}</label>
                <input type="date" name="dateOfBirth" max={new Date().toISOString().slice(0, 10)} value={formData.dateOfBirth} onChange={handleInputChange} required className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
              </div>}
            </div>
          </div>

          {/* Address Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
              <MapPin className="w-6 h-6 text-indigo-600" />
              {t('address')}
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('address')}
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('location')}
              </label>
              <MapContainer
                center={[formData.lat, formData.lng]}
                zoom={15}
                style={mapContainerStyle}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={[formData.lat, formData.lng]}>
                  <Popup>{t('yourLocation')}</Popup>
                </Marker>
                <MapClickHandler onClick={handleMapClick} />
              </MapContainer>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('latitude')}
                  </label>
                  <input
                    type="number"
                    name="lat"
                    value={formData.lat}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('longitude')}
                  </label>
                  <input
                    type="number"
                    name="lng"
                    value={formData.lng}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Speciality Section (Doctors Only) */}
          {profile.role === 'doctor' && (
            <div className="space-y-6 border-b border-gray-200 pb-6 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                <Briefcase className="w-6 h-6 text-indigo-600" />
                {t('specialty')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('specialty')}
                  </label>
                  <select
                    name="speciality"
                    value={formData.speciality}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                  >
                    <option value="">{profile.speciality || t('select')}</option>
                    {specialities.map(speciality => (
                      <option key={speciality} value={speciality}>
                        {speciality}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('hospitalName')}
                  </label>
                  <input
                    type="text"
                    name="hospitalName"
                    value={formData.hospitalName}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
                <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"><FileText className="h-5 w-5 text-indigo-600" />{t('documentCustomization')}</h3>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{t('documentCustomizationHelp')}</p>
                <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-indigo-200 p-3 text-sm dark:border-indigo-900">
                  {formData.doctorLogoPreview ? <img src={formData.doctorLogoPreview} alt={t('doctorLogo')} className="h-14 w-20 object-contain" /> : <FileText className="h-8 w-8 text-indigo-600" />}
                  <span>{t('doctorLogoOptional')}</span>
                  <input type="file" accept="image/png,image/jpeg" onChange={handleDoctorLogoChange} className="sr-only" />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('professionalRegistrationNumber')}</label>
                    <input type="text" name="professionalRegistrationNumber" maxLength={80} value={formData.professionalRegistrationNumber} onChange={handleInputChange} placeholder={t('professionalRegistrationNumberPlaceholder')} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('documentHeader')}</label>
                    <input type="text" name="documentHeader" maxLength={160} value={formData.documentHeader} onChange={handleInputChange} placeholder={t('documentHeaderPlaceholder')} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('documentFooter')}</label>
                    <textarea name="documentFooter" maxLength={500} rows={3} value={formData.documentFooter} onChange={handleInputChange} placeholder={t('documentFooterPlaceholder')} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Section */}
          {profile.role === 'client' && (
            <section className="space-y-4 border-b border-gray-200 pb-6 dark:border-gray-700">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100"><Bell className="h-6 w-6 text-indigo-600" />{t('reminderPreferences')}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('reminderPreferencesHelp')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['inAppEnabled', 'emailEnabled', 'before24h', 'before2h'] as const).map((field) => (
                  <label key={field} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <input type="checkbox" checked={reminderPreferences[field]} onChange={(event) => setReminderPreferences((current) => ({ ...current, [field]: event.target.checked }))} className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{t(`reminderPreference_${field}`)}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => void saveReminderPreferences()} disabled={savingReminderPreferences} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{savingReminderPreferences ? t('saving') : t('saveReminderPreferences')}</button>
              </div>
            </section>
          )}

          <div className="pb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
              <Lock className="w-6 h-6 text-indigo-600" />
              {t('security')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('email')}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>
              <div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('newPassword')}
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('confirmNewPassword')}
                    </label>
                    <input
                      type="password"
                      name="confirmNewPassword"
                      value={passwordData.confirmNewPassword}
                      onChange={handlePasswordChange}
                      className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {t('changePassword')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('saving') : t('save')}
            </button>
          </div>
        </form>

        {/* Password Verification Modal */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('verifyOldPassword')}
              </h3>
              <form onSubmit={handlePasswordVerification}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('oldPassword')}
                  </label>
                  <input
                    type="password"
                    name="oldPassword"
                    value={passwordData.oldPassword}
                    onChange={handlePasswordChange}
                    required
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                  />
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      setPasswordData(prev => ({ ...prev, oldPassword: '' }));
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {passwordLoading ? t('verifying') : t('verify')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
