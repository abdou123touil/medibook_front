import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Calendar, Clock, AlertCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'appointment' | 'reminder' | 'alert';
  title: string;
  message: string;
  time: string;
  read: boolean;
  action?: string | null;
  waitlistEntryId?: string | null;
  doctorId?: string | null;
}

interface NotificationsProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onConfirmWaitlist?: (notification: Notification) => void;
  onRescheduleAppointment?: (notification: Notification) => void;
  onKeepCancellation?: (notification: Notification) => void;
}

export function Notifications({ notifications, onMarkAsRead, onConfirmWaitlist, onRescheduleAppointment, onKeepCancellation }: NotificationsProps) {
  const { t } = useTranslation();
  return (
    <div className="relative ">
      <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            {t('notification')}
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="p-5 text-sm text-slate-500">{t('noNotifications')}</p>
          )}
          {notifications.map((notification) => (
            <div
              key={notification.id}
              role="button"
              tabIndex={0}
              className={`border-b border-slate-100 p-4 transition last:border-0 dark:border-slate-800 ${
                !notification.read ? 'bg-indigo-50/70 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
              onClick={() => !notification.read && onMarkAsRead(notification.id)}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !notification.read) {
                  onMarkAsRead(notification.id);
                }
              }}
            >
              <div className="flex items-start gap-3">
                {notification.type === 'appointment' && (
                  <Calendar className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                )}
                {notification.type === 'reminder' && (
                  <Clock className="w-5 h-5 text-green-600 flex-shrink-0" />
                )}
                {notification.type === 'alert' && (
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                )}
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">{notification.title}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{notification.message}</p>
                  <span className="text-xs text-slate-500 mt-1 dark:text-slate-400">{notification.time}</span>
                  {notification.action === 'confirm_waitlist' && notification.waitlistEntryId && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onConfirmWaitlist?.(notification);
                      }}
                      className="mt-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      {t('confirmSlot')}
                    </button>
                  )}
                  {notification.action === 'reschedule_appointment' && notification.doctorId && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRescheduleAppointment?.(notification);
                        }}
                        className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        {t('chooseAnotherSlot')}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onKeepCancellation?.(notification);
                        }}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {t('keepCancellation')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
