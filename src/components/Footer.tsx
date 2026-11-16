import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* À propos */}
          <div>
            <h3 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">MediBook</h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t('footerDescription')}
            </p>
          </div>

          {/* Liens rapides */}
          <div>
            <h4 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('quickLinks')}</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300">
                  {t('home')}
                </Link>
              </li>
              <li>
                <Link to="/doctors" className="text-sm text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300">
                  {t('findDoctor')}
                </Link>
              </li>
              <li>
                <Link to="/specialties" className="text-sm text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300">
                  {t('specialties')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300">
                  {t('about')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300">
                  {t('contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('contact')}</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                <span className="text-sm text-slate-600 dark:text-slate-300">+33 1 23 45 67 89</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                <a href="mailto:contact@medibook.fr" className="text-sm text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300">
                  contact@medibook.fr
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                <span className="text-sm text-slate-600 dark:text-slate-300">123 Avenue de la Santé, 75001 Paris</span>
              </li>
            </ul>
          </div>

          {/* Réseaux sociaux */}
          <div>
            <h4 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('followUs')}</h4>
            <div className="flex gap-4">
              <a href="#" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
            <div className="mt-6">
              <h5 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{t('newsletter')}</h5>
              <form className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('yourEmail')}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  {t('subscribe')}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
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
