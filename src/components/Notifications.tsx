import React from 'react';
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
}

interface NotificationsProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onConfirmWaitlist?: (notification: Notification) => void;
}

export function Notifications({ notifications, onMarkAsRead, onConfirmWaitlist }: NotificationsProps) {
  return (
    <div className="relative ">
      <div className="absolute right-0 w-96 mt-2 bg-white rounded-xl shadow-lg z-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            Notifications
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="p-5 text-sm text-gray-500">Aucune notification pour le moment.</p>
          )}
          {notifications.map((notification) => (
            <div
              key={notification.id}
              role="button"
              tabIndex={0}
              className={`p-4 border-b border-gray-100 last:border-0 ${
                !notification.read ? 'bg-indigo-50' : ''
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
                  <h4 className="font-medium text-gray-900">{notification.title}</h4>
                  <p className="text-sm text-gray-600">{notification.message}</p>
                  <span className="text-xs text-gray-500 mt-1">{notification.time}</span>
                  {notification.action === 'confirm_waitlist' && notification.waitlistEntryId && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onConfirmWaitlist?.(notification);
                      }}
                      className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Confirmer ce créneau
                    </button>
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
