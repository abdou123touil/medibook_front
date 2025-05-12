import React, { useState, useEffect } from 'react';
import { formatDistanceToNow, isAfter, isBefore, addMinutes, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Video, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface TeleconsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  jitsiUrl: string;
  appointment: {
    date: string;
    time: string;
    status: string;
  };
}

export function TeleconsultationModal({ isOpen, onClose, jitsiUrl, appointment }: TeleconsultationModalProps) {
  const { t, i18n } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isJoinButtonEnabled, setIsJoinButtonEnabled] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  // Parse appointment date and time
  const getAppointmentDateTime = () => {
    const dateStr = new Date(appointment.date).toISOString().split('T')[0];
    const parsedDate = parse(`${dateStr} ${appointment.time}`, 'yyyy-MM-dd HH:mm', new Date());
    return parsedDate;
  };

  // Update timer and button state
  useEffect(() => {
    if (!isOpen || appointment.status !== 'accepted') return;

    const appointmentDateTime = getAppointmentDateTime();
    const fiveMinutesBefore = addMinutes(appointmentDateTime, -5);
    const thirtyMinutesAfter = addMinutes(appointmentDateTime, 30);

    const updateTimer = () => {
      const now = new Date();

      // Check if within join window (5 min before to 30 min after)
      const canJoin = isAfter(now, fiveMinutesBefore) && isBefore(now, thirtyMinutesAfter);
      setIsJoinButtonEnabled(canJoin);

      // Calculate time remaining
      if (isBefore(now, appointmentDateTime)) {
        const distance = formatDistanceToNow(appointmentDateTime, {
          locale: i18n.language === 'fr' ? fr : undefined,
          addSuffix: false,
        });
        setTimeRemaining(distance);
      } else if (isAfter(now, appointmentDateTime) && isBefore(now, thirtyMinutesAfter)) {
        setTimeRemaining(t('consultationInProgress'));
      } else {
        setTimeRemaining(null);
        setIsJoinButtonEnabled(false);
      }
    };

    // Run immediately and every second
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isOpen, appointment, i18n.language, t]);

  // Handle join button click
  const handleJoin = () => {
    if (!isJoinButtonEnabled) {
      toast.error(t('joinNotAvailable'));
      return;
    }
    setIsIframeLoaded(true);
  };

  // Handle join in browser
  const handleJoinInBrowser = () => {
    window.open(jitsiUrl, '_blank');
  };

  // Handle modal close
  const handleClose = () => {
    setIsIframeLoaded(false);
    setTimeRemaining(null);
    setIsJoinButtonEnabled(false);
    onClose();
  };

  if (!isOpen) return null;

  // Check if appointment is accepted
  if (appointment.status !== 'accepted') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('teleconsultation')}
            </h2>
            <button onClick={handleClose} className="text-gray-600 hover:text-gray-900">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            {t('appointmentNotAccepted')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('teleconsultation')}
          </h2>
          <button onClick={handleClose} className="text-gray-600 hover:text-gray-900 dark:hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
          {isIframeLoaded ? (
            <iframe
              src={jitsiUrl}
              allow="camera; microphone; fullscreen"
              className="w-full h-full"
              title="Jitsi Teleconsultation"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-600 dark:text-gray-300">
              {t('clickJoinToStart')}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <div className="text-center">
            {timeRemaining ? (
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {timeRemaining === t('consultationInProgress')
                  ? t('consultationInProgress')
                  : `${t('startsIn')} ${timeRemaining}`}
              </p>
            ) : (
              <p className="text-lg font-medium text-red-600">
                {t('consultationEnded')}
              </p>
            )}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleJoin}
              disabled={!isJoinButtonEnabled}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-white
                ${isJoinButtonEnabled ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'}
              `}
            >
              <Video className="w-5 h-5" />
              {t('joinTeleconsultation')}
            </button>
            <button
              onClick={handleJoinInBrowser}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-full hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              <ExternalLink className="w-5 h-5" />
              {t('joinInBrowser')}
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            {t('ensureCameraMic')}
          </p>
        </div>
      </div>
    </div>
  );
}