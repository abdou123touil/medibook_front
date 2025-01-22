import React from 'react';
import { Bell, Calendar, Clock, AlertCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'appointment' | 'reminder' | 'alert';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface NotificationsProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
}

export function Notifications({ notifications, onMarkAsRead }: NotificationsProps) {
  return (
    <div className="relative">
      <div className="absolute right-0 w-96 mt-2 bg-white rounded-xl shadow-lg z-50">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            Notifications
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 border-b border-gray-100 last:border-0 ${
                !notification.read ? 'bg-indigo-50' : ''
              }`}
              onClick={() => onMarkAsRead(notification.id)}
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
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}