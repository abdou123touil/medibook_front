import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Ressources de traduction
const resources = {
  fr: {
    translation: {
      // PatientDashboard
      dashboardTitle: "Mon Tableau de Bord",
      exportCSV: "Exporter en CSV",
      exportPDF: "Exporter en PDF",
      bookAppointment: "Prendre un rendez-vous",
      period: "Période",
      status: "Statut",
      last7Days: "Derniers 7 jours",
      lastWeek: "Dernière semaine",
      lastMonth: "Dernier mois",
      lastQuarter: "Dernier trimestre",
      lastYear: "Dernière année",
      custom: "Personnalisé",
      all: "Tous",
      pending: "En attente",
      accepted: "Accepté",
      completed: "Terminé",
      cancelled: "Annulé",
      totalAppointments: "Total des rendez-vous",
      totalExpenses: "Dépenses totales",
      upcomingAppointments: "Rendez-vous à venir",
      completionRate: "Taux de complétion",
      appointmentEvolution: "Évolution des rendez-vous",
      statusDistribution: "Répartition des statuts",
      appointmentHistory: "Historique des rendez-vous",
      viewHistory: "Voir l'historique",
      noAppointments:
        "Aucun rendez-vous trouvé. Prenez un rendez-vous pour voir vos statistiques !",
      errorNotLoggedIn: "Veuillez vous connecter pour voir vos statistiques.",
      errorFetch:
        "Une erreur est survenue lors de la récupération des statistiques.",
      profile: "Mon Profil",
      chat: "Chat",
      statistics: "Statistiques",
      dashboard: "Mon Tableau de Bord",
      completeProfile: "Compléter le profil",
      logout: "Déconnexion",
      login: "Connexion",
      teleconsultation: "Téléconsultation",
      videoConsultation: "Consultation en vidéo",

      // DoctorDashboard
      doctorDashboard: "Tableau de Bord Médecin",
      weeklyAppointments: "Rendez-vous de la semaine",
      scheduledAppointments: "rendez-vous prévus",
      completedConsultations: "Consultations terminées",
      thisWeek: "cette semaine",
      availableSlots: "Créneaux disponibles",
      next14Days: "sur les 14 prochains jours",
      bookingSettings: "Paramètres de réservation",
      requireManualConfirmation:
        "Exiger une confirmation manuelle pour les rendez-vous",
      manualConfirmationRequired:
        "Les rendez-vous doivent être confirmés manuellement.",
      autoAcceptAppointments: "Les rendez-vous sont acceptés automatiquement.",
      noAppointmentsThisWeek: "Aucun rendez-vous prévu cette semaine.",
      patient: "Patient",
      nameNotAvailable: "Nom non disponible",
      accept: "Accepter",
      cancel: "Annuler",
      history: "Historique",
      at: "à",
      appointmentAccepted: "Rendez-vous accepté avec succès !",
      appointmentCancelled: "Rendez-vous annulé avec succès !",
      errorDoctorIdNotFound: "ID du médecin non trouvé.",
      errorFetchAppointments: "Erreur lors de la récupération des rendez-vous.",
      errorUnexpectedResponse:
        "Réponse inattendue : les rendez-vous ne sont pas un tableau.",
      errorLoadAppointments: "Impossible de charger les rendez-vous.",
      errorFetchAvailability:
        "Erreur lors de la récupération des disponibilités.",
      errorNoAvailabilityData: "Aucune donnée de disponibilité reçue.",
      errorLoadAvailability: "Erreur lors du chargement des disponibilités.",
      errorUpdateAppointment: "Erreur lors de la mise à jour du rendez-vous.",
      errorTryAgain: "Une erreur est survenue. Veuillez réessayer.",
      errorPleaseLogin: "Veuillez vous connecter.",
      confirmationPreferenceUpdated: "Préférence de confirmation mise à jour.",
      errorUpdate: "Erreur lors de la mise à jour.",
      errorServerUpdate: "Erreur serveur lors de la mise à jour.",
      consultationInProgress: "Consultation en cours.",
      consultationEnded: "Consultation terminée.",
        consultationStarted: "Consultation commencée.",
      startsIn: "Commence dans",
      appointmentNotAccepted: "Rendez-vous non encore accepté.",
    },
  },
  ar: {
    translation: {
      // PatientDashboard
      dashboardTitle: "لوحة تحكمي",
      exportCSV: "تصدير إلى CSV",
      exportPDF: "تصدير إلى PDF",
      bookAppointment: "حجز موعد",
      period: "الفترة",
      status: "الحالة",
      last7Days: "آخر 7 أيام",
      lastWeek: "الأسبوع الماضي",
      lastMonth: "الشهر الماضي",
      lastQuarter: "الربع الأخير",
      lastYear: "السنة الماضية",
      custom: "مخصص",
      all: "الكل",
      pending: "قيد الانتظار",
      accepted: "مقبول",
      completed: "مكتمل",
      cancelled: "ملغى",
      totalAppointments: "إجمالي المواعيد",
      totalExpenses: "إجمالي النفقات",
      upcomingAppointments: "المواعيد القادمة",
      completionRate: "نسبة الإكمال",
      appointmentEvolution: "تطور المواعيد",
      statusDistribution: "توزيع الحالات",
      appointmentHistory: "سجل المواعيد",
      viewHistory: "عرض السجل",
      noAppointments: "لم يتم العثور على مواعيد. قم بحجز موعد لرؤية إحصائياتك!",
      errorNotLoggedIn: "يرجى تسجيل الدخول لرؤية إحصائياتك.",
      errorFetch: "حدث خطأ أثناء جلب الإحصائيات.",
      profile: "ملفي الشخصي",
      chat: "الدردشة",
      statistics: "الإحصائيات",
      dashboard: "لوحة تحكمي",
      completeProfile: "إكمال الملف الشخصي",
      logout: "تسجيل الخروج",
      login: "تسجيل الدخول",
      teleconsultation: "الاستشارة عن بعد",
      videoConsultation: "استشارة بالفيديو",

      // DoctorDashboard
      doctorDashboard: "لوحة تحكم الطبيب",
      weeklyAppointments: "مواعيد الأسبوع",
      scheduledAppointments: "مواعيد مجدولة",
      completedConsultations: "الاستشارات المكتملة",
      thisWeek: "هذا الأسبوع",
      availableSlots: "الفترات المتاحة",
      next14Days: "خلال الـ 14 يومًا القادمة",
      bookingSettings: "إعدادات الحجز",
      requireManualConfirmation: "طلب تأكيد يدوي للمواعيد",
      manualConfirmationRequired: "يجب تأكيد المواعيد يدويًا.",
      autoAcceptAppointments: "يتم قبول المواعيد تلقائيًا.",
      noAppointmentsThisWeek: "لا توجد مواعيد مجدولة هذا الأسبوع.",
      patient: "المريض",
      nameNotAvailable: "الاسم غير متوفر",
      accept: "قبول",
      cancel: "إلغاء",
      history: "السجل",
      at: "في",
      appointmentAccepted: "تم قبول الموعد بنجاح !",
      appointmentCancelled: "تم إلغاء الموعد بنجاح !",
      errorDoctorIdNotFound: "معرف الطبيب غير موجود.",
      errorFetchAppointments: "خطأ أثناء جلب المواعيد.",
      errorUnexpectedResponse: "استجابة غير متوقعة: المواعيد ليست مصفوفة.",
      errorLoadAppointments: "تعذر تحميل المواعيد.",
      errorFetchAvailability: "خطأ أثناء جلب الفترات المتاحة.",
      errorNoAvailabilityData: "لم يتم استلام بيانات التوفر.",
      errorLoadAvailability: "خطأ أثناء تحميل الفترات المتاحة.",
      errorUpdateAppointment: "خطأ أثناء تحديث الموعد.",
      errorTryAgain: "حدث خطأ. يرجى المحاولة مرة أخرى.",
      errorPleaseLogin: "يرجى تسجيل الدخول.",
      confirmationPreferenceUpdated: "تم تحديث تفضيل التأكيد.",
      errorUpdate: "خطأ أثناء التحديث.",
      errorServerUpdate: "خطأ في الخادم أثناء التحديث.",
      startsIn: "يبدأ في",
        consultationEnded: "انتهت الاستشارة.",
        consultationStarted: "بدأت الاستشارة.",
        consultationInProgress: "الاستشارة جارية.",
        appointmentNotAccepted: "لم يتم قبول الموعد بعد.",
    },
  },
  en: {
    translation: {
      // PatientDashboard
      dashboardTitle: "My Dashboard",
      exportCSV: "Export to CSV",
      exportPDF: "Export to PDF",
      bookAppointment: "Book an Appointment",
      period: "Period",
      status: "Status",
      last7Days: "Last 7 Days",
      lastWeek: "Last Week",
      lastMonth: "Last Month",
      lastQuarter: "Last Quarter",
      lastYear: "Last Year",
      custom: "Custom",
      all: "All",
      pending: "Pending",
      accepted: "Accepted",
      completed: "Completed",
      cancelled: "Cancelled",
      totalAppointments: "Total Appointments",
      totalExpenses: "Total Expenses",
      upcomingAppointments: "Upcoming Appointments",
      completionRate: "Completion Rate",
      appointmentEvolution: "Appointment Evolution",
      statusDistribution: "Status Distribution",
      appointmentHistory: "Appointment History",
      viewHistory: "View History",
      noAppointments:
        "No appointments found. Book an appointment to see your statistics!",
      errorNotLoggedIn: "Please log in to view your statistics.",
      errorFetch: "An error occurred while fetching statistics.",
      profile: "My Profile",
      chat: "Chat",
      statistics: "Statistics",
      dashboard: "My Dashboard",
      completeProfile: "Complete Profile",
      logout: "Logout",
      login: "Login",
      teleconsultation: "Teleconsultation",
      videoConsultation: "Video Consultation",

      // DoctorDashboard
      doctorDashboard: "Doctor Dashboard",
      weeklyAppointments: "Weekly Appointments",
      scheduledAppointments: "scheduled appointments",
      completedConsultations: "Completed Consultations",
      thisWeek: "this week",
      availableSlots: "Available Slots",
      next14Days: "in the next 14 days",
      bookingSettings: "Booking Settings",
      requireManualConfirmation: "Require manual confirmation for appointments",
      manualConfirmationRequired: "Appointments must be confirmed manually.",
      autoAcceptAppointments: "Appointments are accepted automatically.",
      noAppointmentsThisWeek: "No appointments scheduled this week.",
      patient: "Patient",
      nameNotAvailable: "Name not available",
      accept: "Accept",
      cancel: "Cancel",
      history: "History",
      at: "at",
      appointmentAccepted: "Appointment accepted successfully!",
      appointmentCancelled: "Appointment cancelled successfully!",
      errorDoctorIdNotFound: "Doctor ID not found.",
      errorFetchAppointments: "Error fetching appointments.",
      errorUnexpectedResponse:
        "Unexpected response: appointments are not an array.",
      errorLoadAppointments: "Unable to load appointments.",
      errorFetchAvailability: "Error fetching availability.",
      errorNoAvailabilityData: "No availability data received.",
      errorLoadAvailability: "Error loading availability.",
      errorUpdateAppointment: "Error updating appointment.",
      errorTryAgain: "An error occurred. Please try again.",
      errorPleaseLogin: "Please log in.",
      confirmationPreferenceUpdated: "Confirmation preference updated.",
      errorUpdate: "Error during update.",
      errorServerUpdate: "Server error during update.",
      consultationEnded: "Consultation ended.",
      consultationStarted: "Consultation started.",
      consultationInProgress: "Consultation in progress.",
      startsIn: "Starts in",
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr", // Langue par défaut : français
    detection: {
      order: ["localStorage", "navigator"], // Priorité : localStorage, puis langue du navigateur
      caches: ["localStorage"], // Stocker la langue choisie dans localStorage
      lookupLocalStorage: "i18nextLng", // Clé explicite pour localStorage
    },
    interpolation: {
      escapeValue: false, // React gère l'échappement XSS
    },
  });

// Ajouter un écouteur pour gérer le changement de langue et le RTL
i18n.on("languageChanged", (lng) => {
  console.log("Language changed to:", lng); // Debug
  document.documentElement.setAttribute("lang", lng);
  document.documentElement.setAttribute("dir", lng === "ar" ? "rtl" : "ltr");
  // Appliquer la police Noto Sans Arabic pour l'arabe
  if (lng === "ar") {
    document.documentElement.style.fontFamily =
      "'Noto Sans Arabic', sans-serif";
  } else {
    document.documentElement.style.fontFamily = "'Inter', sans-serif";
  }
});

export default i18n;
