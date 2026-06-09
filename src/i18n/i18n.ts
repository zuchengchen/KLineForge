import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { detectInitialLanguage } from '../app/defaults';
import { resources } from './resources';

void i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng: 'en-US',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
