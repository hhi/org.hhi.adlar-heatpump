import en from '../../../locales/en.json';
import nl from '../../../locales/nl.json';
import de from '../../../locales/de.json';
import fr from '../../../locales/fr.json';

const texts: Record<string, typeof en.modbusParameterBanks> = {
  en: en.modbusParameterBanks,
  nl: nl.modbusParameterBanks,
  de: de.modbusParameterBanks,
  fr: fr.modbusParameterBanks,
};

export default function parameterBankTexts(acceptLanguage = 'en'): typeof en.modbusParameterBanks {
  const language = acceptLanguage.split(',')
    .map((tag) => tag.split(';')[0].trim().toLowerCase().split('-')[0])
    .find((tag) => Object.prototype.hasOwnProperty.call(texts, tag)) ?? 'en';
  return texts[language];
}
