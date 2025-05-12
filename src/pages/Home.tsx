import React from "react";
import { ThreeScene } from "../components/ThreeScene";
import { ArrowRight, Stethoscope, Calendar, UserCircle } from "lucide-react";
import logo from "../assets/img/logo1.png";
import { motion } from "framer-motion";
export function Home() {
  return (
    <div className="container mx-auto px-4">
      <section className="py-20 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-5xl dark:text-white font-bold text-gray-900 mb-6 "
        >
          Votre Santé, Notre Priorité
        </motion.h1>

        <p className="text-xl text-gray-600 mb-8">
          Prenez rendez-vous avec les meilleurs médecins en quelques clics
        </p>
       
      </section>

      <section className="grid md:grid-cols-3 gap-8 py-16">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
          <Stethoscope className="w-12 h-12 text-indigo-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Médecins Spécialistes</h3>
          <p className="text-gray-600">
            Accédez à un réseau de médecins qualifiés dans diverses spécialités
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
          <Calendar className="w-12 h-12 text-indigo-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Réservation Simple</h3>
          <p className="text-gray-600">
            Réservez votre rendez-vous en ligne 24/7 en quelques étapes
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
          <UserCircle className="w-12 h-12 text-indigo-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Suivi Personnalisé</h3>
          <p className="text-gray-600">
            Gérez vos rendez-vous et accédez à votre historique médical
          </p>
        </div>
      </section>
    </div>
  );
}
