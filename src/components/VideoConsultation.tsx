import React, { useState } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone } from 'lucide-react';

interface VideoConsultationProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentInfo: {
    doctorName: string;
    patientName: string;
    time: string;
  };
}

export function VideoConsultation({ isOpen, onClose, appointmentInfo }: VideoConsultationProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      <div className="flex justify-between items-center p-4 bg-gray-900">
        <div className="text-white">
          <h2 className="font-semibold">Consultation avec Dr. {appointmentInfo.doctorName}</h2>
          <p className="text-sm text-gray-400">{appointmentInfo.time}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3 rounded-full ${
              isMuted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-3 rounded-full ${
              !isVideoOn ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isVideoOn ? (
              <Video className="w-6 h-6 text-white" />
            ) : (
              <VideoOff className="w-6 h-6 text-white" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700"
          >
            <Phone className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-900 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          {isVideoOn ? (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <p className="text-white">Caméra activée</p>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-indigo-600 flex items-center justify-center">
              <span className="text-3xl text-white font-semibold">
                {appointmentInfo.doctorName[0]}
              </span>
            </div>
          )}
        </div>
        {isVideoOn && (
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg shadow-lg">
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-white text-sm">Votre caméra</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}