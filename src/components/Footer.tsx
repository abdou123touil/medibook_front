import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-white dark:bg-gray-900 dark:text-white text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* À propos */}
          <div>
            <h3 className="text-xl font-bold text-black dark:text-white mb-4">MediBook</h3>
            <p className="text-sm leading-relaxed text-black dark:text-white">
              {t('footerDescription')}
            </p>
          </div>

          {/* Liens rapides */}
          <div>
            <h4 className="text-lg font-semibold text-black dark:text-white mb-4">{t('quickLinks')}</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-black dark:text-white hover:text-indigo-400 transition-colors">
                  {t('home')}
                </Link>
              </li>
              <li>
                <Link to="/doctors" className="text-sm text-black dark:text-white hover:text-indigo-400 transition-colors">
                  {t('findDoctor')}
                </Link>
              </li>
              <li>
                <Link to="/specialties" className="text-sm text-black dark:text-white hover:text-indigo-400 transition-colors">
                  {t('specialties')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-black dark:text-white hover:text-indigo-400 transition-colors">
                  {t('about')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-black dark:text-white hover:text-indigo-400 transition-colors">
                  {t('contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold text-black dark:text-white mb-4">{t('contact')}</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-black dark:text-white" />
                <span className="text-sm text-black dark:text-white ">+33 1 23 45 67 89</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-black dark:text-white" />
                <a href="mailto:contact@medibook.fr" className="text-sm hover:text-indigo-400 text-black dark:text-white transition-colors">
                  contact@medibook.fr
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-black dark:text-white" />
                <span className="text-sm text-black dark:text-white">123 Avenue de la Santé, 75001 Paris</span>
              </li>
            </ul>
          </div>

          {/* Réseaux sociaux */}
          <div>
            <h4 className="text-lg font-semibold text-black dark:text-white mb-4">{t('followUs')}</h4>
            <div className="flex gap-4">
              <a href="#" className="p-2 bg-white text-black rounded-full hover:bg-indigo-600 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white text-black rounded-full hover:bg-indigo-600 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white text-black rounded-full hover:bg-indigo-600 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white text-black rounded-full  hover:bg-indigo-600 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
            <div className="mt-6">
              <h5 className="text-sm font-semibold text-black dark:text-white mb-2">{t('newsletter')}</h5>
              <form className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('yourEmail')}
                  className="flex-1 px-3 py-2 bg-white text-black border border-black  rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
                >
                  {t('subscribe')}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-black dark:text-white">
              © {new Date().getFullYear()} MediBook. {t('allRightsReserved')}
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-sm hover:text-indigo-400 text-black dark:text-white transition-colors">
                {t('privacyPolicy')}
              </Link>
              <Link to="/terms" className="text-sm hover:text-indigo-400 text-black dark:text-white transition-colors">
                {t('termsOfUse')}
              </Link>
              <Link to="/legal" className="text-sm hover:text-indigo-400 text-black dark:text-white transition-colors">
                {t('legalNotice')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
