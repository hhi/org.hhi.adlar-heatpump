/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';

// ─── Types ───────────────────────────────────────────────────────────────────

type DomainStatus = 'scored' | 'learning' | 'disabled' | 'unavailable';

interface DomainScore {
  status: DomainStatus;
  score?: number;
  rating?: string;
  detail?: string;
  reason?: string;
  [key: string]: unknown; // Allow extra fields (e.g. telemetry sub-checks)
}

interface TelemetryCheck {
  value?: number;
  optimal?: string;
  ok: boolean;
  interpretation?: string;
  [key: string]: unknown;
}

interface TelemetrySubCategories {
  waterCircuit: {
    waterDelta: TelemetryCheck;
    deltaVsCompressor: TelemetryCheck & { correlation?: number };
    flowIndication: TelemetryCheck & { flow?: number; compressorActive?: boolean };
  };
  refrigerantCircuit: {
    dischargeSuperHeat: TelemetryCheck;
    condensationApproach: TelemetryCheck;
    pressureTempSpread: TelemetryCheck;
  };
  operationalEfficiency: {
    temperatureLift: TelemetryCheck & { rating?: string };
    supplyTempOptimality: TelemetryCheck;
  };
}

export interface PerformanceReport {
  timestamp: string;
  overallScore: number;
  scoredDomains: number;
  totalDomains: number;
  rating: string;
  scores: {
    efficiency: DomainScore;
    building: DomainScore;
    defrost: DomainScore;
    energy: DomainScore;
    pricing: DomainScore;
    telemetry: DomainScore & Partial<TelemetrySubCategories>;
    health: DomainScore;
  };
  recommendations: string[];
  summary: string;
}

export interface PerformanceReportServiceOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

// ─── Translations ────────────────────────────────────────────────────────────

interface Translations {
  ratings: Record<string, string>;
  recommendations: Record<string, string>;
  summaryTemplate: string;
  summaryPartial: string;
  domainNames: Record<string, string>;
  telemetry: Record<string, string>;
}

const TRANSLATIONS: Record<string, Translations> = {
  nl: {
    ratings: { excellent: 'uitstekend', good: 'goed', fair: 'matig', poor: 'slecht' },
    recommendations: {
      defrost_high: 'Defrost-frequentie is hoger dan normaal bij deze temperatuur — controleer buitenunit',
      cop_stable: 'COP-trend is stabiel — goede prestatie',
      cop_low: 'COP is lager dan verwacht — controleer verwarmingscurve-instelling',
      cop_excellent: 'Uitstekende COP-waarde — warmtepomp werkt zeer efficiënt',
      building_learning: 'Gebouwmodel is nog aan het leren — scores worden nauwkeuriger na meer data',
      delta_high: 'Water ΔT is hoog — controleer waterdebiet en filter',
      delta_low: 'Water ΔT is laag — debiet mogelijk te hoog of lage warmtevraag',
      lift_high: 'Temperature lift is hoog — verwarmingscurve mogelijk te steil ingesteld',
      supply_high: 'Aanvoertemperatuur is hoger dan optimaal — overweeg lagere curve-instelling',
      supply_low: 'Aanvoertemperatuur is laag — controleer of warmtevraag wordt gehaald',
      superheat_high: 'Discharge superheat is hoog — EEV-afstelling kan inefficiënt zijn',
      superheat_low: 'Discharge superheat is laag — risico op nat koelmiddel bij compressor',
      condenser_dirty: 'Condensatie approach is hoog — warmtewisselaar mogelijk vervuild of kalk',
      pressure_high: 'Druktemperatuurverschil is hoog — mogelijk overbelasting of koudemiddeltekort',
      no_flow: 'Geen waterdebiet bij actieve compressor — controleer circulatiepomp',
      disconnect_high: 'Veel verbindingsonderbrekingen — controleer WiFi-signaalsterkte',
      energy_high: 'Energieverbruik is hoger dan gemiddeld voor dit seizoen',
      pricing_savings: 'Dynamisch tarief: er is bespaard door slim gebruik van goedkope uren',
    },
    summaryTemplate: 'Je warmtepomp presteert {rating} ({score}/100 op basis van {scored} van {total} domeinen).',
    summaryPartial: ' {missing} niet beschikbaar.',
    domainNames: {
      efficiency: 'Efficiëntie', building: 'Gebouwmodel', defrost: 'Ontdooiing',
      energy: 'Energie', pricing: 'Energieprijzen', telemetry: 'Telemetrie', health: 'Gezondheid',
    },
    telemetry: {
      normal_flow: 'Normaal debiet', high_flow: 'Te hoog debiet of lage last',
      low_flow: 'Te laag debiet, pomp/filter controleren', linear: 'Lineair verband',
      nonlinear: 'Niet-lineair, lucht in systeem?', curve_ok: 'Verwarmingscurve passend',
      curve_steep: 'Verwarmingscurve te steil', optimal_range: 'Optimaal bereik',
      too_high: 'Te hoog ingesteld', too_low: 'Onderdimensionering of laag vermogen',
    },
  },
  en: {
    ratings: { excellent: 'excellent', good: 'good', fair: 'fair', poor: 'poor' },
    recommendations: {
      defrost_high: 'Defrost frequency is higher than normal for this temperature — check outdoor unit',
      cop_stable: 'COP trend is stable — good performance',
      cop_low: 'COP is lower than expected — check heating curve setting',
      cop_excellent: 'Excellent COP value — heat pump operates very efficiently',
      building_learning: 'Building model is still learning — scores will become more accurate with more data',
      delta_high: 'Water ΔT is high — check water flow rate and filter',
      delta_low: 'Water ΔT is low — flow rate may be too high or low heat demand',
      lift_high: 'Temperature lift is high — heating curve may be set too steep',
      supply_high: 'Supply temperature is higher than optimal — consider lower curve setting',
      supply_low: 'Supply temperature is low — check if heat demand is being met',
      superheat_high: 'Discharge superheat is high — EEV adjustment may be inefficient',
      superheat_low: 'Discharge superheat is low — risk of liquid refrigerant at compressor',
      condenser_dirty: 'Condensation approach is high — heat exchanger may be fouled or scaled',
      pressure_high: 'Pressure temperature spread is high — possible overload or refrigerant shortage',
      no_flow: 'No water flow with active compressor — check circulation pump',
      disconnect_high: 'Many connection interruptions — check WiFi signal strength',
      energy_high: 'Energy consumption is higher than average for this season',
      pricing_savings: 'Dynamic tariff: savings achieved by smart use of cheap hours',
    },
    summaryTemplate: 'Your heat pump is performing {rating} ({score}/100 based on {scored} of {total} domains).',
    summaryPartial: ' {missing} not available.',
    domainNames: {
      efficiency: 'Efficiency', building: 'Building model', defrost: 'Defrost',
      energy: 'Energy', pricing: 'Energy prices', telemetry: 'Telemetry', health: 'Health',
    },
    telemetry: {
      normal_flow: 'Normal flow', high_flow: 'Too high flow or low demand',
      low_flow: 'Too low flow, check pump/filter', linear: 'Linear relation',
      nonlinear: 'Non-linear, air in system?', curve_ok: 'Heating curve fitting',
      curve_steep: 'Heating curve too steep', optimal_range: 'Optimal range',
      too_high: 'Set too high', too_low: 'Undersized or low power',
    },
  },
  de: {
    ratings: { excellent: 'ausgezeichnet', good: 'gut', fair: 'mäßig', poor: 'schlecht' },
    recommendations: {
      defrost_high: 'Abtaufrequenz ist höher als normal bei dieser Temperatur — Außengerät prüfen',
      cop_stable: 'COP-Trend ist stabil — gute Leistung',
      cop_low: 'COP ist niedriger als erwartet — Heizkurve-Einstellung prüfen',
      cop_excellent: 'Ausgezeichneter COP-Wert — Wärmepumpe arbeitet sehr effizient',
      building_learning: 'Gebäudemodell lernt noch — Bewertungen werden mit mehr Daten genauer',
      delta_high: 'Wasser ΔT ist hoch — Wasserdurchfluss und Filter prüfen',
      delta_low: 'Wasser ΔT ist niedrig — Durchfluss möglicherweise zu hoch oder geringe Wärmenachfrage',
      lift_high: 'Temperaturdifferenz ist hoch — Heizkurve möglicherweise zu steil eingestellt',
      supply_high: 'Vorlauftemperatur ist höher als optimal — niedrigere Kurveneinstellung erwägen',
      supply_low: 'Vorlauftemperatur ist niedrig — prüfen ob Wärmebedarf gedeckt wird',
      superheat_high: 'Heißgas-Überhitzung ist hoch — EEV-Einstellung kann ineffizient sein',
      superheat_low: 'Heißgas-Überhitzung ist niedrig — Risiko von flüssigem Kältemittel am Kompressor',
      condenser_dirty: 'Kondensationsannäherung ist hoch — Wärmetauscher möglicherweise verschmutzt oder verkalkt',
      pressure_high: 'Drucktemperaturunterschied ist hoch — mögliche Überlastung oder Kältemittelmangel',
      no_flow: 'Kein Wasserdurchfluss bei aktivem Kompressor — Umwälzpumpe prüfen',
      disconnect_high: 'Viele Verbindungsunterbrechungen — WiFi-Signalstärke prüfen',
      energy_high: 'Energieverbrauch ist höher als üblich für diese Jahreszeit',
      pricing_savings: 'Dynamischer Tarif: Einsparungen durch kluge Nutzung günstiger Stunden',
    },
    summaryTemplate: 'Ihre Wärmepumpe arbeitet {rating} ({score}/100 basierend auf {scored} von {total} Bereichen).',
    summaryPartial: ' {missing} nicht verfügbar.',
    domainNames: {
      efficiency: 'Effizienz', building: 'Gebäudemodell', defrost: 'Abtauung',
      energy: 'Energie', pricing: 'Energiepreise', telemetry: 'Telemetrie', health: 'Gesundheit',
    },
    telemetry: {
      normal_flow: 'Normaler Durchfluss', high_flow: 'Zu hoher Durchfluss oder geringe Last',
      low_flow: 'Zu geringer Durchfluss, Pumpe/Filter prüfen', linear: 'Linearer Zusammenhang',
      nonlinear: 'Nicht-linear, Luft im System?', curve_ok: 'Heizkurve passend',
      curve_steep: 'Heizkurve zu steil', optimal_range: 'Optimaler Bereich',
      too_high: 'Zu hoch eingestellt', too_low: 'Unterdimensioniert oder geringe Leistung',
    },
  },
  fr: {
    ratings: { excellent: 'excellent', good: 'bon', fair: 'moyen', poor: 'mauvais' },
    recommendations: {
      defrost_high: 'La fréquence de dégivrage est supérieure à la normale pour cette température — vérifier l\'unité extérieure',
      cop_stable: 'Tendance COP stable — bonne performance',
      cop_low: 'COP inférieur aux attentes — vérifier le réglage de la courbe de chauffe',
      cop_excellent: 'Excellente valeur COP — la pompe à chaleur fonctionne très efficacement',
      building_learning: 'Le modèle de bâtiment est en cours d\'apprentissage — les scores deviendront plus précis avec plus de données',
      delta_high: 'ΔT eau élevé — vérifier le débit d\'eau et le filtre',
      delta_low: 'ΔT eau faible — débit possiblement trop élevé ou faible demande de chaleur',
      lift_high: 'L\'élévation de température est élevée — la courbe de chauffe est peut-être trop raide',
      supply_high: 'Température de départ supérieure à l\'optimal — envisager un réglage de courbe plus bas',
      supply_low: 'Température de départ faible — vérifier si la demande de chaleur est satisfaite',
      superheat_high: 'Surchauffe de refoulement élevée — le réglage EEV peut être inefficace',
      superheat_low: 'Surchauffe de refoulement faible — risque de réfrigérant liquide au compresseur',
      condenser_dirty: 'Approche de condensation élevée — échangeur de chaleur possiblement encrassé ou entartré',
      pressure_high: 'Écart de température de pression élevé — surcharge possible ou manque de réfrigérant',
      no_flow: 'Pas de débit d\'eau avec compresseur actif — vérifier la pompe de circulation',
      disconnect_high: 'Nombreuses interruptions de connexion — vérifier la force du signal WiFi',
      energy_high: 'Consommation d\'énergie supérieure à la moyenne pour cette saison',
      pricing_savings: 'Tarif dynamique : économies réalisées par une utilisation intelligente des heures creuses',
    },
    summaryTemplate: 'Votre pompe à chaleur fonctionne {rating} ({score}/100 basé sur {scored} sur {total} domaines).',
    summaryPartial: ' {missing} non disponible(s).',
    domainNames: {
      efficiency: 'Efficacité', building: 'Modèle bâtiment', defrost: 'Dégivrage',
      energy: 'Énergie', pricing: 'Prix énergie', telemetry: 'Télémétrie', health: 'Santé',
    },
    telemetry: {
      normal_flow: 'Débit normal', high_flow: 'Débit trop élevé ou faible demande',
      low_flow: 'Débit trop faible, vérifier pompe/filtre', linear: 'Relation linéaire',
      nonlinear: 'Non-linéaire, air dans le système?', curve_ok: 'Courbe de chauffe adaptée',
      curve_steep: 'Courbe de chauffe trop raide', optimal_range: 'Plage optimale',
      too_high: 'Réglage trop élevé', too_low: 'Sous-dimensionné ou faible puissance',
    },
  },
};

// ─── Service ─────────────────────────────────────────────────────────────────

const TOTAL_DOMAINS = 7;

/**
 * Domain weight configuration for overall score calculation.
 * Higher weight = more impact on overall score.
 */
const DOMAIN_WEIGHTS: Record<string, number> = {
  efficiency: 2.0,
  building: 1.0,
  defrost: 1.0,
  energy: 1.5,
  pricing: 1.0,
  telemetry: 1.5,
  health: 1.5,
};

export class PerformanceReportService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;

  constructor(options: PerformanceReportServiceOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => { });
  }

  // ─── Main Entry Point ──────────────────────────────────────────────────────

  /**
   * Generate a complete performance report.
   * Reads all available data from capabilities and services, scores each domain,
   * and produces a structured JSON report with recommendations.
   */
  public generateReport(): PerformanceReport {
    this.logger('PerformanceReportService: Generating performance report...');

    const lang = this.getLanguage();
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

    // Score each domain
    const scores = {
      efficiency: this.scoreEfficiency(t),
      building: this.scoreBuilding(t),
      defrost: this.scoreDefrost(t),
      energy: this.scoreEnergy(t),
      pricing: this.scorePricing(t),
      telemetry: this.scoreTelemetry(t),
      health: this.scoreHealth(t),
    };

    // Collect recommendations
    const recommendations = this.collectRecommendations(scores, t);

    // Calculate overall score (weighted average of scored domains only)
    const scoredEntries = Object.entries(scores)
      .filter(([, v]) => v.status === 'scored' && typeof v.score === 'number');
    const scoredDomains = scoredEntries.length;

    let overallScore = 0;
    if (scoredDomains > 0) {
      let totalWeight = 0;
      let weightedSum = 0;
      for (const [key, val] of scoredEntries) {
        const w = DOMAIN_WEIGHTS[key] || 1.0;
        weightedSum += (val.score as number) * w;
        totalWeight += w;
      }
      overallScore = Math.round(weightedSum / totalWeight);
    }

    const rating = this.scoreToRating(overallScore, t);
    const summary = this.generateSummary(overallScore, rating, scoredDomains, scores, t);

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      overallScore,
      scoredDomains,
      totalDomains: TOTAL_DOMAINS,
      rating: rating.toUpperCase(),
      scores,
      recommendations,
      summary,
    };

    this.logger(`PerformanceReportService: Report generated — score ${overallScore}, ${scoredDomains}/${TOTAL_DOMAINS} domains scored`);
    return report;
  }

  // ─── Domain Scoring ────────────────────────────────────────────────────────

  private scoreEfficiency(t: Translations): DomainScore {
    const copEnabled = this.device.getSetting('cop_calculation_enabled');
    if (copEnabled === false) {
      return { status: 'disabled', reason: t.domainNames.efficiency };
    }

    const cop = this.getCapNum('adlar_cop');
    const copDaily = this.getCapNum('adlar_cop_daily');
    const scop = this.getCapNum('adlar_scop');

    // Need at least instant COP
    if (cop === null && copDaily === null) {
      return { status: 'unavailable', reason: 'No COP data' };
    }

    const primaryCop = copDaily ?? cop ?? 0;
    let score: number;

    if (primaryCop >= 4.0) score = 95;
    else if (primaryCop >= 3.5) score = 85;
    else if (primaryCop >= 3.0) score = 75;
    else if (primaryCop >= 2.5) score = 60;
    else if (primaryCop >= 2.0) score = 45;
    else score = 25;

    // SCOP bonus: if available and good, boost score
    if (scop !== null && scop >= 3.5) {
      score = Math.min(100, score + 5);
    }

    const detail = `COP ${(cop ?? 0).toFixed(1)}` +
      (copDaily !== null ? `, dag-COP ${copDaily.toFixed(1)}` : '') +
      (scop !== null ? `, SCOP ${scop.toFixed(1)}` : '');

    return { status: 'scored', score, rating: this.scoreToRating(score, t), detail };
  }

  private scoreBuilding(t: Translations): DomainScore {
    const adaptiveEnabled = this.device.getSetting('adaptive_control_enabled');
    if (adaptiveEnabled === false) {
      return { status: 'disabled', reason: t.domainNames.building };
    }

    const ua = this.getCapNum('adlar_building_ua');
    const tau = this.getCapNum('adlar_building_tau');

    // Read confidence from building_model_diagnostics JSON capability
    let confidence: number | null = null;
    try {
      const diagJson = this.device.getCapabilityValue('building_model_diagnostics') as string | null;
      if (diagJson) {
        const diag = JSON.parse(diagJson);
        if (typeof diag.confidence === 'number') {
          confidence = diag.confidence;
        }
      }
    } catch { /* diagnostics not available */ }

    if (ua === null && tau === null) {
      return { status: 'unavailable', reason: 'No building model data' };
    }

    if (confidence !== null && confidence < 30) {
      return { status: 'learning', reason: `Confidence ${confidence.toFixed(0)}%` };
    }

    // Score based on confidence level and building parameters
    let score = confidence !== null ? Math.min(100, Math.round(confidence)) : 70;

    // Well-insulated buildings (low UA) get a bonus
    if (ua !== null && ua < 0.1) score = Math.min(100, score + 5);
    else if (ua !== null && ua > 0.3) score = Math.max(0, score - 10);

    const profile = this.device.getSetting('building_profile') || 'medium';
    const detail = (ua !== null ? `UA ${ua.toFixed(2)}` : '') +
      (tau !== null ? `${ua !== null ? ', ' : ''}τ ${tau.toFixed(1)}h` : '') +
      `, ${profile} profiel`;

    return { status: 'scored', score, rating: this.scoreToRating(score, t), detail };
  }

  private scoreDefrost(t: Translations): DomainScore {
    const count = this.getCapNum('adlar_defrost_count_24h');
    const minutes = this.getCapNum('adlar_defrost_minutes_24h');

    if (count === null && minutes === null) {
      return { status: 'unavailable', reason: 'No defrost data' };
    }

    const defrostCount = count ?? 0;
    const defrostMinutes = minutes ?? 0;

    // Scoring: fewer defrost cycles = better
    let score: number;
    if (defrostCount === 0) score = 100;
    else if (defrostCount <= 3) score = 90;
    else if (defrostCount <= 6) score = 75;
    else if (defrostCount <= 10) score = 55;
    else score = 35;

    // Penalize long defrost durations
    if (defrostMinutes > 30) score = Math.max(0, score - 15);
    else if (defrostMinutes > 15) score = Math.max(0, score - 5);

    // Estimate COP penalty from defrost
    const copPenaltyPct = defrostMinutes > 0 ? Math.round((defrostMinutes / 1440) * 100) : 0;

    const detail = `${defrostCount} cycli, ${defrostMinutes}min, ${copPenaltyPct}% COP-verlies`;

    return { status: 'scored', score, rating: this.scoreToRating(score, t), detail };
  }

  private scoreEnergy(t: Translations): DomainScore {
    const trackingEnabled = this.device.getSetting('enable_intelligent_energy_tracking');
    if (trackingEnabled === false) {
      return { status: 'disabled', reason: t.domainNames.energy };
    }

    const costDaily = this.getCapNum('adlar_energy_cost_daily');
    const energyDaily = this.getCapNum('adlar_external_energy_daily');
    const power = this.getCapNum('measure_power');

    if (costDaily === null && energyDaily === null && power === null) {
      return { status: 'unavailable', reason: 'No energy data' };
    }

    // Score based on reasonable consumption patterns
    // Lower daily cost relative to running hours = better efficiency
    let score = 80; // Default: assume reasonable

    // If daily energy available, check average power
    if (energyDaily !== null && energyDaily > 0) {
      const avgPower = (energyDaily / 24) * 1000; // rough kWh to W average
      if (avgPower < 400) score = 95;
      else if (avgPower < 700) score = 85;
      else if (avgPower < 1200) score = 70;
      else if (avgPower < 2000) score = 55;
      else score = 40;
    }

    const parts: string[] = [];
    if (energyDaily !== null) parts.push(`${energyDaily.toFixed(1)} kWh vandaag`);
    if (power !== null) parts.push(`${Math.round(power)}W huidig`);
    if (costDaily !== null) parts.push(`€${costDaily.toFixed(2)}/dag`);

    return {
      status: 'scored', score, rating: this.scoreToRating(score, t),
      detail: parts.join(', ') || 'Energie tracking actief',
    };
  }

  private scorePricing(t: Translations): DomainScore {
    const priceOptEnabled = this.device.getSetting('price_optimizer_enabled');
    if (priceOptEnabled === false) {
      return { status: 'disabled', reason: t.domainNames.pricing };
    }

    // Check if dynamic pricing data is available via adaptive control
    const hasDynamic = this.checkHasDynamicPricing();
    if (!hasDynamic) {
      return { status: 'unavailable', reason: 'Geen dynamische energieprijzen' };
    }

    const currentPrice = this.getCapNum('adlar_energy_price_current');
    const costDaily = this.getCapNum('adlar_energy_cost_daily');

    let score = 75; // Default for having dynamic pricing
    const detail = (currentPrice !== null ? `€${currentPrice.toFixed(4)}/kWh` : '')
      + (costDaily !== null ? `, €${costDaily.toFixed(2)}/dag` : '')
      + ', dynamisch tarief';

    return { status: 'scored', score, rating: this.scoreToRating(score, t), detail };
  }

  private scoreTelemetry(t: Translations): DomainScore & Partial<TelemetrySubCategories> {
    const inlet = this.getCapNum('measure_temperature.temp_top');
    const outlet = this.getCapNum('measure_temperature.temp_bottom');
    const discharge = this.getCapNum('measure_temperature.venting_temp');
    const ambient = this.getCapNum('measure_temperature.around_temp');
    const highPressureSat = this.getCapNum('measure_temperature.temp_current_f');
    const lowPressureSat = this.getCapNum('measure_temperature.top_temp_f');
    const condenser = this.getCapNum('measure_temperature.bottom_temp_f');
    const compressorFreq = this.getCapNum('measure_frequency.compressor_strength');
    const flow = this.getCapNum('measure_water');
    const compressorState = this.device.getCapabilityValue('adlar_state_compressor_state') as boolean | null;

    const isCompressorActive = compressorState === true || (compressorFreq !== null && compressorFreq > 0);

    // ── Water circuit checks ──
    let waterDeltaCheck: TelemetryCheck;
    let deltaVsCompressorCheck: TelemetryCheck & { correlation?: number };
    let flowIndicationCheck: TelemetryCheck & { flow?: number; compressorActive?: boolean };

    if (inlet !== null && outlet !== null && isCompressorActive) {
      const deltaT = outlet - inlet; // Heating mode: outlet > inlet
      const absDelta = Math.abs(deltaT);

      let deltaOk: boolean;
      let deltaInterp: string;
      if (absDelta >= 3 && absDelta <= 6) { deltaOk = true; deltaInterp = t.telemetry.normal_flow; }
      else if (absDelta < 3) { deltaOk = false; deltaInterp = t.telemetry.high_flow; }
      else { deltaOk = false; deltaInterp = t.telemetry.low_flow; }

      waterDeltaCheck = { value: Number(absDelta.toFixed(1)), optimal: '3-6', ok: deltaOk, interpretation: deltaInterp };
    } else {
      waterDeltaCheck = { ok: true, interpretation: 'Compressor inactief' };
    }

    // ΔT vs compressor correlation (simplified: check if compressor freq and delta are proportional)
    if (compressorFreq !== null && inlet !== null && outlet !== null && isCompressorActive) {
      const absDelta = Math.abs(outlet - inlet);
      // At higher frequencies we expect higher ΔT; simple ratio check
      const expectedDeltaPerHz = 0.1; // ~0.1°C per Hz as rough baseline
      const expectedDelta = compressorFreq * expectedDeltaPerHz;
      const ratio = expectedDelta > 0 ? absDelta / expectedDelta : 1;
      const corrOk = ratio >= 0.3 && ratio <= 3.0; // Wide tolerance
      deltaVsCompressorCheck = {
        correlation: Number(Math.min(1, ratio).toFixed(2)),
        ok: corrOk,
        interpretation: corrOk ? t.telemetry.linear : t.telemetry.nonlinear,
      };
    } else {
      deltaVsCompressorCheck = { ok: true, interpretation: 'N/A' };
    }

    // Flow indication
    flowIndicationCheck = {
      flow: flow ?? undefined,
      compressorActive: isCompressorActive,
      ok: !isCompressorActive || flow === null || flow > 0,
    };

    // ── Refrigerant circuit checks ──
    let dischargeSuperHeatCheck: TelemetryCheck;
    let condensationApproachCheck: TelemetryCheck;
    let pressureTempSpreadCheck: TelemetryCheck;

    if (discharge !== null && highPressureSat !== null && isCompressorActive) {
      const superheat = discharge - highPressureSat;
      dischargeSuperHeatCheck = {
        value: Number(superheat.toFixed(1)), optimal: '10-40',
        ok: superheat >= 10 && superheat <= 40,
      };
    } else {
      dischargeSuperHeatCheck = { ok: true };
    }

    if (condenser !== null && outlet !== null && isCompressorActive) {
      const approach = condenser - outlet;
      condensationApproachCheck = {
        value: Number(approach.toFixed(1)), optimal: '0-5',
        ok: approach >= 0 && approach <= 5,
      };
    } else {
      condensationApproachCheck = { ok: true };
    }

    if (highPressureSat !== null && lowPressureSat !== null && isCompressorActive) {
      const spread = highPressureSat - lowPressureSat;
      pressureTempSpreadCheck = {
        value: Number(spread.toFixed(1)), optimal: '20-60',
        ok: spread >= 20 && spread <= 60,
      };
    } else {
      pressureTempSpreadCheck = { ok: true };
    }

    // ── Operational efficiency checks ──
    let temperatureLiftCheck: TelemetryCheck & { rating?: string };
    let supplyTempCheck: TelemetryCheck;

    if (outlet !== null && ambient !== null && isCompressorActive) {
      const lift = outlet - ambient;
      let liftRating: string;
      let liftOk: boolean;
      if (lift < 30) { liftRating = 'bonus'; liftOk = true; }
      else if (lift <= 45) { liftRating = 'normaal'; liftOk = true; }
      else { liftRating = 'penalty'; liftOk = false; }

      temperatureLiftCheck = {
        value: Number(lift.toFixed(1)), ok: liftOk,
        rating: liftRating,
        interpretation: liftOk ? t.telemetry.curve_ok : t.telemetry.curve_steep,
      };
    } else {
      temperatureLiftCheck = { ok: true, rating: 'N/A' };
    }

    if (outlet !== null && isCompressorActive) {
      const supplyOk = outlet >= 35 && outlet <= 45;
      let interpretation: string;
      if (supplyOk) interpretation = t.telemetry.optimal_range;
      else if (outlet > 45) interpretation = t.telemetry.too_high;
      else interpretation = t.telemetry.too_low;

      supplyTempCheck = {
        value: Number(outlet.toFixed(1)), optimal: '35-45', ok: supplyOk,
        interpretation,
      };
    } else {
      supplyTempCheck = { ok: true };
    }

    // ── Calculate telemetry score ──
    const allChecks = [
      waterDeltaCheck, deltaVsCompressorCheck, flowIndicationCheck,
      dischargeSuperHeatCheck, condensationApproachCheck, pressureTempSpreadCheck,
      temperatureLiftCheck, supplyTempCheck,
    ];

    // Operational efficiency checks (cat 3) weight double
    const checkWeights = [1, 1, 1, 1, 1, 1, 2, 2]; // Last two are cat 3
    let totalWeight = 0;
    let weightedOk = 0;
    allChecks.forEach((check, i) => {
      totalWeight += checkWeights[i];
      if (check.ok) weightedOk += checkWeights[i];
    });

    const score = totalWeight > 0 ? Math.round((weightedOk / totalWeight) * 100) : 100;
    const okCount = allChecks.filter((c) => c.ok).length;

    const detail = isCompressorActive
      ? `ΔT ${waterDeltaCheck.value ?? '?'}°C, lift ${temperatureLiftCheck.value ?? '?'}°C, supply ${supplyTempCheck.value ?? '?'}°C, ${okCount}/${allChecks.length} checks OK`
      : `Compressor inactief, ${okCount}/${allChecks.length} checks OK`;

    return {
      status: 'scored',
      score,
      rating: this.scoreToRating(score, TRANSLATIONS[this.getLanguage()] || TRANSLATIONS.en),
      detail,
      waterCircuit: {
        waterDelta: waterDeltaCheck,
        deltaVsCompressor: deltaVsCompressorCheck,
        flowIndication: flowIndicationCheck,
      },
      refrigerantCircuit: {
        dischargeSuperHeat: dischargeSuperHeatCheck,
        condensationApproach: condensationApproachCheck,
        pressureTempSpread: pressureTempSpreadCheck,
      },
      operationalEfficiency: {
        temperatureLift: temperatureLiftCheck,
        supplyTempOptimality: supplyTempCheck,
      },
    };
  }

  private scoreHealth(t: Translations): DomainScore {
    const disconnects = this.getCapNum('adlar_daily_disconnect_count');
    const fault = this.device.getCapabilityValue('adlar_fault') as string | null;
    const connectionStatus = this.device.getCapabilityValue('adlar_connection_status') as string | null;

    let score = 100;

    // Disconnect penalty
    const dc = disconnects ?? 0;
    if (dc > 10) score -= 30;
    else if (dc > 5) score -= 15;
    else if (dc > 2) score -= 5;

    // Fault penalty
    if (fault && fault !== '0' && fault !== '' && fault !== 'none') {
      score -= 25;
    }

    // Connection status
    if (connectionStatus && connectionStatus !== 'connected' && connectionStatus !== 'online') {
      score -= 20;
    }

    score = Math.max(0, Math.min(100, score));

    const detail = `${dc} disconnects` +
      (fault && fault !== '0' ? `, fault: ${fault}` : ', geen fouten');

    return { status: 'scored', score, rating: this.scoreToRating(score, t), detail };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getCapNum(capabilityId: string): number | null {
    try {
      if (!this.device.hasCapability(capabilityId)) return null;
      const val = this.device.getCapabilityValue(capabilityId);
      if (typeof val === 'number' && Number.isFinite(val)) return val;
      return null;
    } catch {
      return null;
    }
  }

  private getLanguage(): string {
    try {
      const lang: string = this.device.homey.i18n.getLanguage() || 'en';
      return TRANSLATIONS[lang] ? lang : 'en';
    } catch {
      return 'en';
    }
  }

  private scoreToRating(score: number, t: Translations): string {
    if (score >= 90) return t.ratings.excellent;
    if (score >= 70) return t.ratings.good;
    if (score >= 50) return t.ratings.fair;
    return t.ratings.poor;
  }

  private checkHasDynamicPricing(): boolean {
    try {
      // @ts-expect-error - Accessing MyDevice.serviceCoordinator
      const adaptiveControl = this.device.serviceCoordinator?.getAdaptiveControl?.();
      if (adaptiveControl && typeof adaptiveControl.hasDynamicPricing === 'function') {
        return adaptiveControl.hasDynamicPricing();
      }
      return false;
    } catch {
      return false;
    }
  }

  private collectRecommendations(
    scores: PerformanceReport['scores'],
    t: Translations,
  ): string[] {
    const recs: string[] = [];

    // Efficiency recommendations
    if (scores.efficiency.status === 'scored') {
      const s = scores.efficiency.score ?? 0;
      if (s >= 90) recs.push(t.recommendations.cop_excellent);
      else if (s >= 70) recs.push(t.recommendations.cop_stable);
      else recs.push(t.recommendations.cop_low);
    }

    // Building
    if (scores.building.status === 'learning') {
      recs.push(t.recommendations.building_learning);
    }

    // Defrost
    if (scores.defrost.status === 'scored' && (scores.defrost.score ?? 100) < 60) {
      recs.push(t.recommendations.defrost_high);
    }

    // Telemetry — operational recommendations
    if (scores.telemetry.status === 'scored') {
      const tel = scores.telemetry as DomainScore & Partial<TelemetrySubCategories>;

      if (tel.waterCircuit?.waterDelta && !tel.waterCircuit.waterDelta.ok) {
        const delta = tel.waterCircuit.waterDelta.value ?? 0;
        recs.push(delta < 3 ? t.recommendations.delta_low : t.recommendations.delta_high);
      }

      if (tel.waterCircuit?.flowIndication && !tel.waterCircuit.flowIndication.ok) {
        recs.push(t.recommendations.no_flow);
      }

      if (tel.refrigerantCircuit?.dischargeSuperHeat && !tel.refrigerantCircuit.dischargeSuperHeat.ok) {
        const sh = tel.refrigerantCircuit.dischargeSuperHeat.value ?? 25;
        recs.push(sh < 10 ? t.recommendations.superheat_low : t.recommendations.superheat_high);
      }

      if (tel.refrigerantCircuit?.condensationApproach && !tel.refrigerantCircuit.condensationApproach.ok) {
        recs.push(t.recommendations.condenser_dirty);
      }

      if (tel.refrigerantCircuit?.pressureTempSpread && !tel.refrigerantCircuit.pressureTempSpread.ok) {
        recs.push(t.recommendations.pressure_high);
      }

      if (tel.operationalEfficiency?.temperatureLift && !tel.operationalEfficiency.temperatureLift.ok) {
        recs.push(t.recommendations.lift_high);
      }

      if (tel.operationalEfficiency?.supplyTempOptimality && !tel.operationalEfficiency.supplyTempOptimality.ok) {
        const sv = tel.operationalEfficiency.supplyTempOptimality.value ?? 40;
        recs.push(sv > 45 ? t.recommendations.supply_high : t.recommendations.supply_low);
      }
    }

    // Health
    if (scores.health.status === 'scored' && (scores.health.score ?? 100) < 70) {
      recs.push(t.recommendations.disconnect_high);
    }

    return recs;
  }

  private generateSummary(
    overallScore: number,
    rating: string,
    scoredDomains: number,
    scores: PerformanceReport['scores'],
    t: Translations,
  ): string {
    let summary = t.summaryTemplate
      .replace('{rating}', rating)
      .replace('{score}', String(overallScore))
      .replace('{scored}', String(scoredDomains))
      .replace('{total}', String(TOTAL_DOMAINS));

    // List missing domains
    const missingDomains = Object.entries(scores)
      .filter(([, v]) => v.status !== 'scored')
      .map(([k]) => t.domainNames[k] || k);

    if (missingDomains.length > 0) {
      summary += t.summaryPartial.replace('{missing}', missingDomains.join(', '));
    }

    return summary;
  }
}
