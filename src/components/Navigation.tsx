import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { LogIn, UserCircle, LogOut, MessageSquare, TrendingUp, BarChart, Bell } from "lucide-react";
import { AuthModal } from "./AuthModal";
import { motion } from "framer-motion";
import logo from "../assets/img/logo1.png";
import { ThemeToggle } from "./ThemeToggle";
import { Chat } from "./Chat";
import { Notifications } from "./Notifications";
import toast from "react-hot-toast";
import { apiFetch } from "../lib/api";

interface NotificationItem {
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

export function Navigation() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser } = useAuthStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('appoiment');
    let active = true;
    apiFetch('http://localhost:3000/api/users/profile')
      .then(async (response) => response.ok ? response.json() : null)
      .then((profile) => { if (active) setUser(profile ? { data: profile } : null); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, [setUser]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    let isActive = true;
    const loadNotifications = async () => {
      try {
        const response = await apiFetch('http://localhost:3000/api/notifications');
        if (!response.ok) return;
        const data = await response.json();
        if (!isActive) return;
        setNotifications((data.notifications || []).map((item: any) => ({
          id: item._id,
          type: item.type,
          title: item.title,
          message: item.message,
          time: new Date(item.createdAt).toLocaleString(),
          read: Boolean(item.readAt),
          action: item.action || null,
          waitlistEntryId: item.waitlistEntryId || null,
          doctorId: item.doctorId?._id || item.doctorId || null,
        })));
      } catch (error) {
        
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  const markNotificationAsRead = async (id: string) => {
    const previous = notifications;
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
    try {
      const response = await apiFetch(`http://localhost:3000/api/notifications/${id}/read`, { method: 'PATCH' });
      if (!response.ok) setNotifications(previous);
    } catch {
      setNotifications(previous);
    }
  };

  const confirmWaitlistOffer = async (notification: NotificationItem) => {
    if (!notification.waitlistEntryId) return;
    try {
      const response = await apiFetch(`http://localhost:3000/api/waitlist/${notification.waitlistEntryId}/confirm`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de confirmer ce créneau.');
      setNotifications((items) => items.map((item) => item.id === notification.id
        ? { ...item, read: true, action: null }
        : item));
      toast.success(data.message || 'Créneau réservé avec succès.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de confirmer ce créneau.');
    }
  };

  const completeAbsenceNotification = async (notification: NotificationItem) => {
    setNotifications((items) => items.map((item) => item.id === notification.id
      ? { ...item, read: true, action: null }
      : item));
    try {
      const response = await apiFetch(`http://localhost:3000/api/notifications/${notification.id}/action-complete`, { method: 'PATCH' });
      if (!response.ok) throw new Error('Impossible de clôturer cette notification.');
    } catch (error) {
      
    }
  };

  const rescheduleAfterAbsence = (notification: NotificationItem) => {
    if (!notification.doctorId) return;
    void completeAbsenceNotification(notification);
    navigate('/client', { state: { rebookDoctorId: notification.doctorId } });
  };

  const keepAbsenceCancellation = (notification: NotificationItem) => {
    void completeAbsenceNotification(notification);
    toast.success('Annulation conservée.');
  };

  const handleLogout = () => {
    void apiFetch('http://localhost:3000/api/users/logout', { method: 'POST' });
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("appoiment");
    navigate("/");
  };

  const uselrole = () => {
    if (user?.data?.role === "doctor") {
      navigate("/doctor");
    } else {
      navigate("/client");
    }
  };

  const handleClose = () => {
    setIsChatOpen(false);
  };

  const isProfileIncomplete = !user?.data?.firstName;

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex dark:text-indigo-400 justify-between items-center h-16">
            <img onClick={uselrole} src={logo} alt="Logo" className="w-20 h-19" />

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate('/profile')}
                    className="flex items-center space-x-2 dark:text-white text-gray-700 hover:text-indigo-600"
                  >
                    <UserCircle className="w-5 h-5" />
                    <span>{user?.data?.firstName || t("profile")}</span>
                  </button>

                  <button
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="flex items-center space-x-2 dark:text-white text-gray-700 hover:text-indigo-600"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>{t("chat")}</span>
                  </button>



                  {user?.data?.role === "doctor" && (
                    <Link
                      to="/doctor/statistics"
                      className="flex items-center space-x-2 dark:text-white text-gray-700 hover:text-indigo-600"
                    >
                      <TrendingUp className="w-5 h-5" />
                      <span>{t("statistics")}</span>
                    </Link>
                  )}

                  {user?.data?.role === "client" && (
                    <Link
                      to="/patient/dashboard"
                      className="flex items-center space-x-2 dark:text-white text-gray-700 hover:text-emerald-600"
                    >
                      <BarChart className="w-5 h-5" />
                      <span>{t("dashboard")}</span>
                    </Link>
                  )}

                  {isChatOpen && (
                    <motion.div
                      initial={{ right: "-400px" }}
                      animate={{ right: 0 }}
                      exit={{ right: "-400px" }}
                      className="fixed top-2 right-0 z-50 w-[500px] h-full"
                    >
                      <Chat onClose={handleClose} />
                    </motion.div>
                  )}

                  {isProfileIncomplete && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <Link
                        to="/profile-completion"
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                      >
                        {t("completeProfile")}
                      </Link>
                    </motion.div>
                  )}
                   <div className="relative">
                    <button
                      onClick={() => setIsNotificationsOpen((open) => !open)}
                      className="relative flex items-center space-x-2 dark:text-white text-gray-700 hover:text-indigo-600"
                      aria-label="Afficher les notifications"
                      aria-expanded={isNotificationsOpen}
                    >
                      <Bell className="w-5 h-5" />
                      {notifications.some((item) => !item.read) && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                      )} <span>{t("notification")}</span>
                    </button>

                    {isNotificationsOpen && (
                      <Notifications
                        notifications={notifications}
                        onMarkAsRead={markNotificationAsRead}
                        onConfirmWaitlist={confirmWaitlistOffer}
                        onRescheduleAppointment={rescheduleAfterAbsence}
                        onKeepCancellation={keepAbsenceCancellation}
                      />
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 dark:text-white text-gray-600 hover:text-gray-800"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>{t("logout")}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <LogIn className="w-5 h-5" />
                  <span>{t("login")}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
