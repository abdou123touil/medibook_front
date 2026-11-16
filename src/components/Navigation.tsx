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
      <nav className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="container mx-auto px-4">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2 dark:text-indigo-400">
            <img onClick={uselrole} src={logo} alt="Logo" className="h-14 w-20 cursor-pointer object-contain" />

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <ThemeToggle />
              <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate('/profile')}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                  >
                    <UserCircle className="w-5 h-5" />
                    <span>{user?.data?.firstName || t("profile")}</span>
                  </button>

                  <button
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>{t("chat")}</span>
                  </button>



                  {user?.data?.role === "doctor" && (
                    <Link
                      to="/doctor/statistics"
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                    >
                      <TrendingUp className="w-5 h-5" />
                      <span>{t("statistics")}</span>
                    </Link>
                  )}

                  {user?.data?.role === "client" && (
                    <Link
                      to="/patient/dashboard"
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
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
                      className="fixed inset-y-2 right-2 z-50 h-[calc(100vh-1rem)] w-[min(500px,calc(100vw-1rem))]"
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
                        className="inline-flex min-h-10 items-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                      >
                        {t("completeProfile")}
                      </Link>
                    </motion.div>
                  )}
                   <div className="relative">
                    <button
                      onClick={() => setIsNotificationsOpen((open) => !open)}
                      className="relative inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
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
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>{t("logout")}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
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
