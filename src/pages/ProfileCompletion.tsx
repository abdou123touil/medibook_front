import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Upload, User, FileText, Building } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import  {Map}  from '../components/Map';

import { z } from 'zod';

const profileSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  cinNumber: z.string().min(4, "Le numéro CIN doit contenir au moins 4 caractères"),
  address: z.string().min(5, "L'adresse doit contenir au moins 5 caractères"),
  speciality: z.string().optional(),
  hospital: z.string().optional(),
});

interface LocationCoordinates {
  lat: number;
  lng: number;
}

export function ProfileCompletion() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const { user, updateUser } = useAuthStore();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    profileImage: null as File | null,
    profileImagePreview: '',
    cinFront: null as File | null,
    cinFrontPreview: '',
    cinBack: null as File | null,
    cinBackPreview: '',
    cinNumber: '',
    location: { lat: 33.5731, lng: -7.5898 } as LocationCoordinates,
    address: '',
    speciality: '',
    hospital: '',
  });
  useEffect(() => {
    if (user?.role) return;
    const userRole = localStorage.getItem('role');
    if (userRole) updateUser?.({ role: userRole });
  }, []);
  

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'profileImage' | 'cinFront' | 'cinBack'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        [field]: file,
        [`${field}Preview`]: URL.createObjectURL(file),
      }));
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      location: { lat, lng },
    }));
  };

  const uploadImages = async () => {
    const uploads = [];
    
    if (formData.profileImage) {
      const path = `profiles/${user!.id}/profile-${Date.now()}`;
      uploads.push(uploadFile('profile-images', path, formData.profileImage));
    }
    
    if (formData.cinFront) {
      const path = `cin/${user!.id}/front-${Date.now()}`;
      uploads.push(uploadFile('cin-images', path, formData.cinFront));
    }
    
    if (formData.cinBack) {
      const path = `cin/${user!.id}/back-${Date.now()}`;
      uploads.push(uploadFile('cin-images', path, formData.cinBack));
    }

    const [profileUrl, cinFrontUrl, cinBackUrl] = await Promise.all(uploads);
    return { profileUrl, cinFrontUrl, cinBackUrl };
  };
  const handleNextStep = () => {
    const validationResult = profileSchema.safeParse(formData);
    console.log(step)

    setStep(step + 1);
    console.log(step)
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent page reload
    if (step < 3) {
      handleNextStep();
      return;
    }
    try {
      // Log formData to check the location value before proceeding
      console.log('Form Data:', formData);
        
      const formDataToSend = new FormData();
      // Append the form data for each field (including files)
      formDataToSend.append('firstName', formData.firstName);
      formDataToSend.append('lastName', formData.lastName);
      
      // Ensure files are available before appending
      if (formData.profileImage) {
        formDataToSend.append('profileImage', formData.profileImage);
      }
      if (formData.cinFront) {
        formDataToSend.append('cinFront', formData.cinFront);
      }
      if (formData.cinBack) {
        formDataToSend.append('cinBack', formData.cinBack);
      }
  
      formDataToSend.append('cinNumber', formData.cinNumber);
      formDataToSend.append('address', formData.address);
  
      // Ensure location is available before appending lat/lng
      if (formData.location && formData.location.lat && formData.location.lng) {
        formDataToSend.append('latitude', formData.location.lat.toString());
        formDataToSend.append('longitude', formData.location.lng.toString());
      } else {
        throw new Error("Location is not properly selected");
      }
  
      // If doctor, append speciality and hospital/clinic info
      if (localStorage.getItem('role') === 'doctor'){
        console.log('the role is ',localStorage.getItem('role'))
        formDataToSend.append('speciality', formData.speciality);
        formDataToSend.append('hospitalName', formData.hospital);
        formDataToSend.append('availability', JSON.stringify({}));
      }
      const passw=localStorage.getItem('password')
      formDataToSend.append('password',passw)
      const email=localStorage.getItem('email')
      formDataToSend.append('email',email)
      const roles=localStorage.getItem('role')
      formDataToSend.append('role',roles)

      
      // Log the FormData content
      console.log('Form Data to send:', formDataToSend);
      for (let [key, value] of formDataToSend.entries()) {
        console.log(key, value);
    }
      // Send the data to the backend using fetch
      const response = await fetch('http://localhost:3000/api/users/register', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`, // If you need the token
        },
        body: formDataToSend,
      }).then(response => response.json())
      .then(data => console.log('Response:', data))
      .catch(error => console.error('Error:', error));
  
    
  
      const result = await response.json();
      console.log('Backend response:', result);
  
      // Store the user data in localStorage if successful
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: result.id,
          firstName: result.firstName,
          lastName: result.lastName,
          email: result.email,
          role: result.role,
        })
      );
  
      // Navigate to the appropriate dashboard based on user role
      if (result.role === 'doctor') {
        navigate('/doctor');
      } else {
        navigate('/client');
      }
  
    } catch (error) {
      console.error('Error during registration:', error);
      // Handle error and notify user (for example, with a toast or alert)
    }
  };
  
  

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">Prénom</label>
        <input
          id="firstName"
          type="text"
          value={formData.firstName}
          onChange={e => setFormData({ ...formData, firstName: e.target.value })}
          className="mt-1 p-2 w-full border rounded-md"
        />
        {errors.firstName && <span className="text-red-500 text-sm">{errors.firstName}</span>}
      </div>
      <div>
        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Nom</label>
        <input
          id="lastName"
          type="text"
          value={formData.lastName}
          onChange={e => setFormData({ ...formData, lastName: e.target.value })}
          className="mt-1 p-2 w-full border rounded-md"
        />
        {errors.lastName && <span className="text-red-500 text-sm">{errors.lastName}</span>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Photo de profil
        </label>
        <div className="flex items-center space-x-6">
          <div className="w-32 h-32 relative">
            {formData.profileImagePreview ? (
              <img
                src={formData.profileImagePreview}
                alt="Profile preview"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-indigo-600 p-2 rounded-full cursor-pointer hover:bg-indigo-700 transition-colors">
              <Upload className="w-4 h-4 text-white" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'profileImage')}
              />
            </label>
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="cinNumber" className="block text-sm font-medium text-gray-700">Numéro CIN</label>
        <input
          id="cinNumber"
          type="text"
          value={formData.cinNumber}
          onChange={e => setFormData({ ...formData, cinNumber: e.target.value })}
          className="mt-1 p-2 w-full border rounded-md"
        />
        {errors.cinNumber && <span className="text-red-500 text-sm">{errors.cinNumber}</span>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CIN Recto
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            {formData.cinFrontPreview ? (
              <img
                src={formData.cinFrontPreview}
                alt="CIN front preview"
                className="max-h-32 mx-auto"
              />
            ) : (
              <label className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-500">Cliquez pour ajouter</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'cinFront')}
                />
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CIN Verso
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            {formData.cinBackPreview ? (
              <img
                src={formData.cinBackPreview}
                alt="CIN back preview"
                className="max-h-32 mx-auto"
              />
            ) : (
              <label className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-500">Cliquez pour ajouter</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'cinBack')}
                />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Adresse complète
        </label>
        <div className="relative">
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Entrez votre adresse"
            required
          />
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        </div>
        {errors.address && (
          <p className="mt-1 text-sm text-red-600">{errors.address}</p>
        )}
      </div>

      <div className="h-64">
        <Map
          onLocationSelect={handleLocationSelect}
          initialPosition={[formData.location.lat, formData.location.lng]}
        />
      </div>
    </div>
  );

  const renderStep3 = () => {
    const userRole = localStorage.getItem('role');

    if (userRole !== 'doctor') return null;
    
        return (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Spécialité
                </label>
                <select
                  value={formData.speciality}
                  onChange={(e) => setFormData(prev => ({ ...prev, speciality: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="">Sélectionnez votre spécialité</option>
                  <option value="generaliste">Médecin Généraliste</option>
                  <option value="cardiologue">Cardiologue</option>
                  <option value="dermatologue">Dermatologue</option>
                  <option value="pediatre">Pédiatre</option>
                  <option value="psychiatre">Psychiatre</option>
                  <option value="ophtalmologue">Ophtalmologue</option>
                </select>
                {errors.speciality && (
                  <p className="mt-1 text-sm text-red-600">{errors.speciality}</p>
                )}
              </div>
      
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Établissement / Cabinet
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.hospital}
                    onChange={(e) => setFormData(prev => ({ ...prev, hospital: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nom de l'établissement"
                    required
                  />
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                {errors.hospital && (
                  <p className="mt-1 text-sm text-red-600">{errors.hospital}</p>
                )}
              </div>
            </div>
          );
  };
  
  const renderStepNavigation = () => (
    <div className="flex justify-between mt-6">
      {step > 1 && (
        <button
          onClick={() => setStep(step - 1)}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
        >
          Précédent
        </button>
      )}
  
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition"
      >
        {step < 3 ? 'Suivant' : 'Soumettre'}
      </button>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Complétez votre profil</h1>
            <p className="text-gray-600 mt-2">
              {step === 1 && "Ajoutez vos informations personnelles"}
              {step === 2 && "Précisez votre localisation"}
              {step === 3 && "Informations professionnelles"}
            </p>
          </div>
  
          <form onSubmit={handleSubmit}>
            <div className="mb-8">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </div>
  
            {renderStepNavigation()}
          </form>
        </div>
      </div>
    </div>
  );
}


