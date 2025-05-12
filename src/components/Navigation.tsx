import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { LogIn, UserCircle, LogOut, MessageSquare, TrendingUp, BarChart, Globe } from "lucide-react";
import { AuthModal } from "./AuthModal";
import { motion } from "framer-motion";
import logo from "../assets/img/logo1.png";
import { ThemeToggle } from "./ThemeToggle";
import { Chat } from "./Chat";

export function Navigation() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser, setToken } = useAuthStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, [setUser, setToken]);

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("appoiment");
    navigate("/");
  };

  const uselrole = () => {
    const storedUser = localStorage.getItem("user");
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser?.data?.role === "doctor") {
      navigate("/doctor");
    } else {
      navigate("/client");
    }
  };

  const handleClose = () => {
    setIsChatOpen(false);
  };

  const storedAppiment = localStorage.getItem("appoiment");
  const parsed = JSON.parse(storedAppiment || "{}");
  const appointmentList = parsed.appoiment || [];
  const selectedAppointment =
    appointmentList.find((appt: any) => appt.status === "completed") ||
    appointmentList[0];
  const appointmentId = selectedAppointment?._id;
  const otherUserId =
    selectedAppointment?.patientId?._id || selectedAppointment?.doctorId?._id;
  const otherUserName = selectedAppointment?.patientId?.firstName || "John Doe";

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