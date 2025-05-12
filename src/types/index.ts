export type User = {
  id: string;
  email: string;
  role: 'client' | 'doctor';
  firstName: string;
  lastName: string;
  phoneNumber?: string;
};

export type Doctor = User & {
  speciality: string;
  description: string;
  availability: {
    [date: string]: string[]; // Array of available time slots
  };
};

export type Appointment = {
  id: string;
  doctorId: string;
  patientId: string;
  date: string;
  time: string;
  symptoms: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
};