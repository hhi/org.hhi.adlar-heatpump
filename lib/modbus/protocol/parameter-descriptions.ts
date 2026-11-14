import en from '../../../locales/en.json';
import nl from '../../../locales/nl.json';
import de from '../../../locales/de.json';
import fr from '../../../locales/fr.json';

const descriptions: Record<string, typeof en.modbusRegisterDescriptions> = {
  en: en.modbusRegisterDescriptions,
  nl: nl.modbusRegisterDescriptions,
  de: de.modbusRegisterDescriptions,
  fr: fr.modbusRegisterDescriptions,
};

const descriptionKeys = new Map<number, keyof typeof en.modbusRegisterDescriptions>([
  [0x0106, 'fan_type'],
  [0x0309, 'heat_pump_clock_description'],
  [0x0803, 'sterilization_start_hour'],
]);

const slopePartners = new Map([[0x081A, 'L38'], [0x082D, 'L57'], [0x0830, 'L60']]);
const constantPartners = new Map([[0x081B, 'L37'], [0x082E, 'L56'], [0x0831, 'L59']]);

function localizedDescriptions(acceptLanguage: string): typeof en.modbusRegisterDescriptions {
  const language = acceptLanguage.split(',')
    .map((tag) => tag.split(';')[0].trim().toLowerCase().split('-')[0])
    .find((tag) => Object.prototype.hasOwnProperty.call(descriptions, tag)) ?? 'en';
  return descriptions[language];
}

/** Localize the new expert descriptions using the browser's preferred language. */
export default function parameterDescription(address: number, acceptLanguage = 'en'): string | undefined {
  const key = descriptionKeys.get(address);
  return key ? localizedDescriptions(acceptLanguage)[key] : undefined;
}

export function parameterName(address: number, acceptLanguage = 'en'): string | undefined {
  return address === 0x0309 ? localizedDescriptions(acceptLanguage).heat_pump_clock : undefined;
}

export function unknownControlRegister(acceptLanguage = 'en'): { name: string; desc: string } {
  const texts = localizedDescriptions(acceptLanguage);
  return { name: texts.unknown_control_register, desc: texts.unknown_control_register_description };
}

/** Diagnostic hypothesis only: neither the curve role nor its outdoor anchors are confirmed. */
export function suspectedCurvePoint(address: number, acceptLanguage = 'en'): { name: string; desc: string } | undefined {
  if (!Number.isInteger(address) || address < 0x081F || address > 0x0828) return undefined;
  const texts = localizedDescriptions(acceptLanguage);
  const point = String(address - 0x081F);
  return {
    name: texts.suspected_custom_curve_point.replace('{point}', point),
    desc: texts.suspected_custom_curve_point_description.replace('{point}', point),
  };
}

/** Pattern-based annotations never assign a scale, formula, curve number or switch polarity. */
export function suspectedLParameter(address: number, acceptLanguage = 'en'): { name: string; desc: string } | undefined {
  const point = suspectedCurvePoint(address, acceptLanguage);
  if (point) return point;
  const texts = localizedDescriptions(acceptLanguage);
  const slopePartner = slopePartners.get(address);
  if (slopePartner) {
    return {
      name: texts.suspected_curve_slope,
      desc: texts.suspected_curve_slope_description.replace('{partner}', slopePartner),
    };
  }
  const constantPartner = constantPartners.get(address);
  if (constantPartner) {
    return {
      name: texts.suspected_curve_constant,
      desc: texts.suspected_curve_constant_description.replace('{partner}', constantPartner),
    };
  }
  if (address === 0x081C || address === 0x081D) {
    return {
      name: texts.suspected_hour_setting.replace('{index}', String(address - 0x081B)),
      desc: texts.suspected_hour_setting_description,
    };
  }
  if (address === 0x081E || address === 0x082F) {
    return { name: texts.binary_parameter, desc: texts.binary_parameter_description };
  }
  return undefined;
}
