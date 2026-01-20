/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/**
 * Building Insights Service - Actionable recommendations from Building Model
 *
 * Analyzes learned thermal parameters (C, UA, τ, g, P_int) and provides
 * concrete recommendations for energy savings and comfort optimization.
 *
 * Insight Categories:
 * 1. Insulation Performance (10-30% savings potential)
 * 2. Pre-Heating Strategy (5-10% savings potential)
 * 3. Thermal Storage Optimization (10-25% savings potential)
 * 4. Building Profile Mismatch (diagnostic)
 *
 * @version 2.5.0
 * @since 2.5.0
 */

import Homey from 'homey';
import type { BuildingModelService } from './building-model-service';
import type { AdaptiveControlService } from './adaptive-control-service';
import { BUILDING_PROFILES, type BuildingProfileType } from '../adaptive/building-model-learner';

type BuildingModelDiagnostics = Awaited<ReturnType<BuildingModelService['getDiagnosticStatus']>>;

export interface BuildingInsightsServiceConfig {
  device: Homey.Device;
  buildingModelService: BuildingModelService;
  adaptiveControlService: AdaptiveControlService;
  logger?: (msg: string, ...args: unknown[]) => void;
}

export type InsightCategory = 'insulation_performance' | 'pre_heating' | 'thermal_storage' | 'profile_mismatch';
export type InsightStatus = 'new' | 'active' | 'dismissed';

export interface Insight {
  id: string; // "thermal_storage_2024_01_09"
  category: InsightCategory;
  priority: number; // 0-100
  confidence: number; // 0-100
  detectedAt: number; // timestamp
  insight: string; // Human-readable message
  recommendation: string; // Actionable advice
  estimatedSavings?: number; // EUR/month
  status: InsightStatus;
  dismissedUntil?: number; // timestamp
}

export interface InsightState {
  activeInsights: Insight[];
  history: Insight[];
  lastEvaluation: number;
}

/**
 * Building Insights Service
 *
 * Responsibilities:
 * - Analyze building model every 10 samples (50 minutes)
 * - Detect 3 priority insight categories + profile mismatch
 * - Update 3 insight capabilities with recommendations
 * - Trigger flow cards when new insights detected
 * - Manage insight lifecycle (new → active → dismissed)
 * - Persist insight history to device store
 */
export class BuildingInsightsService {
  private device: Homey.Device;
  private buildingModel: BuildingModelService;
  private adaptiveControl: AdaptiveControlService;
  private logger: (msg: string, ...args: unknown[]) => void;

  // State
  private activeInsights: Map<string, Insight> = new Map();
  private insightHistory: Insight[] = [];
  private lastEvaluationTime: number = 0;
  private samplesSinceLastEval: number = 0;

  // Config (from device settings)
  private enabled: boolean = true;
  private minConfidence: number = 70;
  // Note: maxActiveInsights removed in v2.5.10 - each category has dedicated capability

  // Timers
  private evaluationTimer: NodeJS.Timeout | null = null;
  private preHeatRecommendationTimer: NodeJS.Timeout | null = null;
  private readonly EVALUATION_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes (10 samples @ 5min)

  constructor(config: BuildingInsightsServiceConfig) {
    this.device = config.device;
    this.buildingModel = config.buildingModelService;
    this.adaptiveControl = config.adaptiveControlService;
    this.logger = config.logger || (() => { });

    // Load settings
    this.enabled = this.device.getSetting('building_insights_enabled') ?? true;
    this.minConfidence = this.device.getSetting('insights_min_confidence') ?? 70;
    // insights_max_active setting removed - each category has dedicated capability
  }

  /**
   * Get current Homey language (nl/en)
   */
  private getLanguage(): string {
    return this.device.homey.i18n.getLanguage();
  }

  /**
   * Initialize service
   * - Restore persisted state
   * - Start periodic insight evaluation
   * - Schedule daily pre-heat recommendations
   * - Update capabilities with current insights
   */
  public async initialize(): Promise<void> {
    this.logger('BuildingInsightsService: Initializing...');

    if (!this.enabled) {
      this.logger('BuildingInsightsService: Disabled in settings, skipping initialization');
      return;
    }

    // Restore state from device store
    await this.restoreState();

    // Evaluate insights immediately on initialization (v2.5.21)
    // This ensures capabilities show current status right after app install/update
    await this.evaluateInsights();

    // Start periodic evaluation (every 50 minutes)
    this.evaluationTimer = this.device.homey.setInterval(
      () => this.evaluateInsights().catch((err) => this.logger('BuildingInsightsService: Evaluation error:', err)),
      this.EVALUATION_INTERVAL_MS,
    );

    // Schedule daily pre-heat recommendation trigger (23:00)
    this.schedulePreHeatRecommendation();

    this.logger(`BuildingInsightsService: Initialized successfully (interval: ${this.EVALUATION_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Destroy service
   * - Clear all timers
   * - Persist current state
   */
  public async destroy(): Promise<void> {
    this.logger('BuildingInsightsService: Destroying...');

    // Clear timers
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }

    if (this.preHeatRecommendationTimer) {
      clearInterval(this.preHeatRecommendationTimer);
      this.preHeatRecommendationTimer = null;
    }

    // Persist final state
    await this.persistState();

    this.logger('BuildingInsightsService: Destroyed successfully');
  }

  /**
   * Handle settings changes
   * - Update configuration
   * - Re-evaluate insights if thresholds changed
   */
  public async onSettingsChanged(settings: Record<string, unknown>): Promise<void> {
    this.logger('BuildingInsightsService: Settings changed, updating configuration...');

    let configChanged = false;

    if (typeof settings.building_insights_enabled === 'boolean') {
      this.enabled = settings.building_insights_enabled;
      configChanged = true;
    }

    if (typeof settings.insights_min_confidence === 'number') {
      this.minConfidence = settings.insights_min_confidence;
      configChanged = true;
    }


    // Note: insights_max_active setting removed in v2.5.10

    if (configChanged && this.enabled) {
      // Re-evaluate insights with new thresholds
      await this.evaluateInsights();
    }
  }

  /**
   * Core insight evaluation (called every 50 minutes OR on-demand)
   * - Check if model has sufficient confidence
   * - Detect insights in all 4 categories
   * - Prioritize top insights
   * - Update capabilities and trigger flow cards
   */
  public async evaluateInsights(): Promise<void> {
    this.logger('BuildingInsightsService: Evaluating insights...');

    if (!this.enabled) {
      this.logger('BuildingInsightsService: Disabled, skipping evaluation');
      return;
    }

    // Defensive: Check if building model service is ready
    try {
      // Get building model diagnostics
      const diagnostics = await this.buildingModel.getDiagnosticStatus();
      this.logger(`BuildingInsightsService: Model confidence: ${diagnostics.confidence}%`);

      // Defensive: Validate diagnostics object structure
      if (!diagnostics || typeof diagnostics.confidence !== 'number') {
        this.logger('BuildingInsightsService: Invalid diagnostics object, skipping evaluation');
        return;
      }
    } catch (error) {
      this.logger('BuildingInsightsService: Building model not ready yet, skipping evaluation:', error);
      return;
    }

    // Re-fetch diagnostics for detection methods
    const diagnostics = await this.buildingModel.getDiagnosticStatus();

    // Detect insights in all categories
    const detectedInsights: Insight[] = [];

    // 1. Insulation Performance (requires 70% confidence)
    const insulationInsight = this.detectInsulationInsights(diagnostics);
    if (insulationInsight) detectedInsights.push(insulationInsight);

    // 2. Pre-Heating Strategy (requires 70% confidence)
    const preHeatingInsight = this.detectPreHeatingInsights(diagnostics);
    if (preHeatingInsight) detectedInsights.push(preHeatingInsight);

    // 3. Thermal Storage Optimization (requires 70% confidence)
    const thermalStorageInsight = this.detectThermalStorageInsights(diagnostics);
    if (thermalStorageInsight) detectedInsights.push(thermalStorageInsight);

    // 4. Building Profile Mismatch (requires 50% confidence - diagnostic)
    const profileMismatchInsight = this.detectProfileMismatch(diagnostics);
    if (profileMismatchInsight) detectedInsights.push(profileMismatchInsight);

    this.logger(`BuildingInsightsService: Detected ${detectedInsights.length} insights`);

    // Prioritize insights
    const prioritizedInsights = this.prioritizeInsights(detectedInsights);

    // Process each insight
    for (const insight of prioritizedInsights) {
      // Always add/update in activeInsights (for UI display)
      this.activeInsights.set(insight.category, insight);

      // Check if we should trigger flow card (advice fatigue prevention)
      if (this.shouldTriggerInsight(insight)) {
        // Update status to active
        this.updateInsightStatus(insight);

        // Trigger appropriate flow card
        await this.triggerInsightFlowCard(insight);

        // Add to history
        this.insightHistory.push(insight);
      }
    }

    // Prune old history (keep last 50 entries)
    if (this.insightHistory.length > 50) {
      this.insightHistory = this.insightHistory.slice(-50);
    }

    // Update capabilities
    await this.updateInsightCapabilities();

    // Persist state
    await this.persistState();

    this.lastEvaluationTime = Date.now();
    this.logger('BuildingInsightsService: Evaluation complete');
  }

  /**
   * Detect insulation performance insights
   * - Compare learned UA with expected UA from building profile
   * - Calculate potential savings from insulation upgrades
   * - Always returns an insight (learning/poor/good/average)
   */
  private detectInsulationInsights(diagnostics: BuildingModelDiagnostics): Insight | null {
    const model = this.buildingModel.getLearner().getModel();
    const lang = this.getLanguage();

    // Learning phase - insufficient confidence
    if (diagnostics.confidence < this.minConfidence) {
      return {
        id: `insulation_learning_${Date.now()}`,
        category: 'insulation_performance',
        priority: 10,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: lang === 'nl'
          ? `⏳ Aan het leren (${diagnostics.confidence.toFixed(1)}%)`
          : `⏳ Learning (${diagnostics.confidence.toFixed(1)}%)`,
        recommendation: '',
        status: 'new',
      };
    }

    // Defensive: Validate UA is a valid number in expected range
    if (!Number.isFinite(model.UA) || model.UA <= 0 || model.UA > 2.0) {
      this.logger('BuildingInsightsService: Invalid UA value for insulation detection:', model.UA);
      return null;
    }

    const profile = this.device.getSetting('building_profile') || 'average';

    // Defensive: Validate profile exists
    if (!(profile in BUILDING_PROFILES)) {
      this.logger('BuildingInsightsService: Invalid building profile:', profile);
      return null;
    }

    const expectedUA = BUILDING_PROFILES[profile as BuildingProfileType].UA;

    // High heat loss detected (UA > 1.5× expected OR absolute high)
    if (model.UA > expectedUA * 1.5 || model.UA > 0.5) {
      const savingsEstimate = this.estimateInsulationSavings(model.UA, expectedUA);

      const recommendation = lang === 'nl'
        ? `🔴 Hoog verlies • Dak/muren/ramen • €${savingsEstimate}/mnd`
        : `🔴 High loss • Roof/walls/windows • €${savingsEstimate}/mo`;

      return {
        id: `insulation_poor_${Date.now()}`,
        category: 'insulation_performance',
        priority: 85,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: recommendation,
        recommendation,
        estimatedSavings: savingsEstimate,
        status: 'new',
      };
    }

    // Good insulation (better than expected)
    if (model.UA < expectedUA * 0.7) {
      const recommendation = lang === 'nl'
        ? '✅ Goed geïsoleerd'
        : '✅ Well insulated';

      return {
        id: `insulation_good_${Date.now()}`,
        category: 'insulation_performance',
        priority: 30,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: recommendation,
        recommendation,
        status: 'new',
      };
    }

    // Average insulation (within expectations)
    const recommendation = lang === 'nl'
      ? '✅ Binnen verwachting'
      : '✅ Within expectations';

    return {
      id: `insulation_average_${Date.now()}`,
      category: 'insulation_performance',
      priority: 30,
      confidence: diagnostics.confidence,
      detectedAt: Date.now(),
      insight: recommendation,
      recommendation,
      status: 'new',
    };
  }

  /**
   * Detect pre-heating strategy insights
   * - Categorize thermal response speed (fast/medium/slow)
   * - Suggest optimal night setback strategy
   * - Always returns an insight (learning/fast/medium/slow)
   */
  private detectPreHeatingInsights(diagnostics: BuildingModelDiagnostics): Insight | null {
    const model = this.buildingModel.getLearner().getModel();
    const lang = this.getLanguage();

    // Learning phase - insufficient confidence
    if (diagnostics.confidence < this.minConfidence) {
      return {
        id: `pre_heating_learning_${Date.now()}`,
        category: 'pre_heating',
        priority: 10,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: lang === 'nl'
          ? `⏳ Aan het leren (${diagnostics.confidence.toFixed(1)}%)`
          : `⏳ Learning (${diagnostics.confidence.toFixed(1)}%)`,
        recommendation: '',
        status: 'new',
      };
    }

    // Defensive: Validate C and UA before division
    if (!Number.isFinite(model.C) || model.C <= 0 || model.C > 100) {
      this.logger('BuildingInsightsService: Invalid C value for pre-heating detection:', model.C);
      return null;
    }
    if (!Number.isFinite(model.UA) || model.UA <= 0) {
      this.logger('BuildingInsightsService: Invalid UA value (division by zero risk):', model.UA);
      return null;
    }

    // Calculate time constant
    const tau = model.C / model.UA; // hours

    // Defensive: Validate tau is finite and in reasonable range (0.5h - 250h)
    if (!Number.isFinite(tau) || tau < 0.5 || tau > 250) {
      this.logger('BuildingInsightsService: Invalid tau calculated for pre-heating:', tau);
      return null;
    }

    // Categorize thermal response and provide compact recommendation
    let category: string;
    let recommendation: string;
    let priority: number;

    if (tau < 5) {
      category = 'fast_response';
      priority = 75;
      recommendation = lang === 'nl'
        ? '⏱️ Nacht 16°C, voorverw. 2u • 12% besparing'
        : '⏱️ Night 16°C, pre-heat 2h • 12% saved';
    } else if (tau < 15) {
      category = 'medium_response';
      priority = 60;
      recommendation = lang === 'nl'
        ? '⏱️ Nacht 17°C, voorverw. 4u • 8% besparing'
        : '⏱️ Night 17°C, pre-heat 4h • 8% saved';
    } else {
      category = 'slow_response';
      priority = 50;
      recommendation = lang === 'nl'
        ? '⏱️ Nacht 18°C, voorverw. 6u+ • Overweeg continu'
        : '⏱️ Night 18°C, pre-heat 6h+ • Consider continuous';
    }

    return {
      id: `pre_heating_${category}_${Date.now()}`,
      category: 'pre_heating',
      priority,
      confidence: diagnostics.confidence,
      detectedAt: Date.now(),
      insight: recommendation,
      recommendation,
      status: 'new',
    };
  }

  /**
   * Detect thermal storage optimization insights
   * - Check for high thermal mass + slow response
   * - Verify dynamic pricing availability
   * - Calculate potential savings from load shifting
   * - Always returns an insight (learning/active/potential/not-suitable)
   */
  private detectThermalStorageInsights(diagnostics: BuildingModelDiagnostics): Insight | null {
    const model = this.buildingModel.getLearner().getModel();
    const lang = this.getLanguage();

    // Learning phase - insufficient confidence
    if (diagnostics.confidence < this.minConfidence) {
      return {
        id: `thermal_storage_learning_${Date.now()}`,
        category: 'thermal_storage',
        priority: 10,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: lang === 'nl'
          ? `⏳ Aan het leren (${diagnostics.confidence.toFixed(1)}%)`
          : `⏳ Learning (${diagnostics.confidence.toFixed(1)}%)`,
        recommendation: '',
        status: 'new',
      };
    }

    // Defensive: Validate C and UA before calculations
    if (!Number.isFinite(model.C) || model.C <= 0 || model.C > 100) {
      this.logger('BuildingInsightsService: Invalid C value for thermal storage detection:', model.C);
      return null;
    }
    if (!Number.isFinite(model.UA) || model.UA <= 0) {
      this.logger('BuildingInsightsService: Invalid UA value for thermal storage detection:', model.UA);
      return null;
    }

    const tau = model.C / model.UA;

    // Defensive: Validate tau
    if (!Number.isFinite(tau) || tau < 0) {
      this.logger('BuildingInsightsService: Invalid tau for thermal storage:', tau);
      return null;
    }

    const hasDynamicPricing = this.adaptiveControl.hasDynamicPricing();

    // High thermal mass + slow response = thermal storage potential
    if (model.C > 18 && tau > 12) {
      if (hasDynamicPricing) {
        const savingsEstimate = this.estimateThermalStorageSavings(model.C, tau);

        const recommendation = lang === 'nl'
          ? `💰 +2°C goedkoop uur, -1°C piek • €${savingsEstimate}/mnd`
          : `💰 +2°C cheap hr, -1°C peak • €${savingsEstimate}/mo`;

        return {
          id: `thermal_storage_active_${Date.now()}`,
          category: 'thermal_storage',
          priority: 90,
          confidence: diagnostics.confidence,
          detectedAt: Date.now(),
          insight: recommendation,
          recommendation,
          estimatedSavings: savingsEstimate,
          status: 'new',
        };
      }
      // Potential exists but dynamic pricing not configured
      const recommendation = lang === 'nl'
        ? '💡 Voeg dynamische prijzen toe • 15-25% potentieel'
        : '💡 Add dynamic pricing • 15-25% potential';

      return {
        id: `thermal_storage_potential_${Date.now()}`,
        category: 'thermal_storage',
        priority: 65,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: recommendation,
        recommendation,
        status: 'new',
      };
    }

    // Low thermal mass - not suitable for load shifting
    const recommendation = lang === 'nl'
      ? '✅ Beperkte massa • Niet rendabel'
      : '✅ Limited mass • Not economical';

    return {
      id: `thermal_storage_unsuitable_${Date.now()}`,
      category: 'thermal_storage',
      priority: 30,
      confidence: diagnostics.confidence,
      detectedAt: Date.now(),
      insight: recommendation,
      recommendation,
      status: 'new',
    };
  }

  /**
   * Detect building profile mismatch
   * - Compare learned τ with profile τ
   * - Suggest optimal profile for faster learning
   * - Always returns an insight (learning/mismatch/matches)
   * - Uses 50% confidence threshold (lower for rough detection)
   */
  private detectProfileMismatch(diagnostics: BuildingModelDiagnostics): Insight | null {
    const model = this.buildingModel.getLearner().getModel();
    const lang = this.getLanguage();

    // Learning phase - lower threshold (50%) for rough detection
    if (diagnostics.confidence < 50) {
      return {
        id: `profile_learning_${Date.now()}`,
        category: 'profile_mismatch',
        priority: 10,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: lang === 'nl'
          ? `⏳ Aan het leren (${diagnostics.confidence.toFixed(1)}%)`
          : `⏳ Learning (${diagnostics.confidence.toFixed(1)}%)`,
        recommendation: '',
        status: 'new',
      };
    }

    // Defensive: Validate C and UA before calculations
    if (!Number.isFinite(model.C) || model.C <= 0 || !Number.isFinite(model.UA) || model.UA <= 0) {
      this.logger('BuildingInsightsService: Invalid C or UA for profile mismatch detection');
      return null;
    }

    const currentProfile = this.device.getSetting('building_profile') || 'average';

    // Defensive: Validate profile exists
    if (!(currentProfile in BUILDING_PROFILES)) {
      this.logger('BuildingInsightsService: Invalid current profile for mismatch detection:', currentProfile);
      return null;
    }

    const currentProfileParams = BUILDING_PROFILES[currentProfile as BuildingProfileType];

    const learnedTau = model.C / model.UA;
    const profileTau = currentProfileParams.C / currentProfileParams.UA;

    // Defensive: Validate calculated tau values
    if (!Number.isFinite(learnedTau) || !Number.isFinite(profileTau) || profileTau <= 0) {
      this.logger('BuildingInsightsService: Invalid tau values for profile mismatch');
      return null;
    }
    const deviation = Math.abs(learnedTau - profileTau) / profileTau;

    // Significant mismatch (>30% deviation)
    if (deviation > 0.3) {
      const suggestedProfile = this.findClosestProfile(model);

      const recommendation = lang === 'nl'
        ? `🔄 Wijzig naar '${suggestedProfile}' profiel in instellingen`
        : `🔄 Change to '${suggestedProfile}' profile in settings`;

      return {
        id: `profile_mismatch_${Date.now()}`,
        category: 'profile_mismatch',
        priority: 40,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: recommendation,
        recommendation,
        status: 'new',
      };
    }

    // Profile matches well (≤30% deviation)
    const recommendation = lang === 'nl'
      ? `✅ Profiel '${currentProfile}' past goed`
      : `✅ Profile '${currentProfile}' matches well`;

    return {
      id: `profile_matches_${Date.now()}`,
      category: 'profile_mismatch',
      priority: 30,
      confidence: diagnostics.confidence,
      detectedAt: Date.now(),
      insight: recommendation,
      recommendation,
      status: 'new',
    };
  }

  /**
   * Prioritize insights by priority score
   * - Sort by priority (high to low)
   * Note: No limit needed - each category has a dedicated capability (v2.5.10)
   */
  private prioritizeInsights(insights: Insight[]): Insight[] {
    return insights.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if insight should trigger (advice fatigue prevention)
   * 
   * Logic order (v2.5.1 fix):
   * 1. Check if dismissed by user
   * 2. Check for significant drift (>10%) - bypasses time limit if true
   * 3. Check time-based fatigue (12 hours)
   */
  private shouldTriggerInsight(insight: Insight): boolean {
    const existingInsight = this.activeInsights.get(insight.category);

    // STEP 1: Check if dismissed by user
    if (existingInsight?.dismissedUntil && Date.now() < existingInsight.dismissedUntil) {
      this.logger(`BuildingInsightsService: Insight ${insight.category} dismissed until ${new Date(existingInsight.dismissedUntil).toISOString()}`);
      return false;
    }

    // STEP 2: Significant drift (>10%) bypasses time-based blocking
    // This ensures important parameter changes are always reported
    if (existingInsight) {
      const confidenceDrift = Math.abs(insight.confidence - existingInsight.confidence) / 100;
      if (confidenceDrift >= 0.10) {
        this.logger(`BuildingInsightsService: Significant drift detected (${(confidenceDrift * 100).toFixed(1)}%) - bypassing time limit for ${insight.category}`);
        return true; // Allow re-trigger regardless of time
      }
    }

    // STEP 3: Time-based fatigue (12 hours for unchanged insights)
    const FATIGUE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 hours (v2.5.1: reduced from 24h)
    const recentInsight = this.insightHistory.find(
      (h) => h.category === insight.category && Date.now() - h.detectedAt < FATIGUE_PERIOD_MS,
    );
    if (recentInsight) {
      this.logger(`BuildingInsightsService: Insight ${insight.category} already triggered within 12 hours (no significant change)`);
      return false;
    }

    return true;
  }

  /**
   * Update insight status
   * - Mark as active
   * - Clear dismissed timestamp
   */
  private updateInsightStatus(insight: Insight): void {
    insight.status = 'active';
    delete insight.dismissedUntil;
  }

  /**
   * Trigger appropriate flow card based on insight category
   */
  private async triggerInsightFlowCard(insight: Insight): Promise<void> {
    try {
      if (insight.category === 'profile_mismatch') {
        // Trigger building_profile_mismatch
        const model = this.buildingModel.getLearner().getModel();
        const currentProfile = this.device.getSetting('building_profile') || 'average';
        const currentProfileParams = BUILDING_PROFILES[currentProfile as BuildingProfileType];
        const learnedTau = model.C / model.UA;
        const profileTau = currentProfileParams.C / currentProfileParams.UA;
        const deviation = Math.abs(learnedTau - profileTau) / profileTau;
        const suggestedProfile = this.findClosestProfile(model);

        await this.device.homey.flow
          .getDeviceTriggerCard('building_profile_mismatch')
          .trigger(this.device, {
            current_profile: currentProfile,
            suggested_profile: suggestedProfile,
            tau_learned: learnedTau,
            tau_profile: profileTau,
            deviation_percent: Math.round(deviation * 100),
            confidence: insight.confidence,
          });

        this.logger('BuildingInsightsService: Triggered profile_mismatch flow card');
      } else {
        // Trigger generic building_insight_detected
        await this.device.homey.flow
          .getDeviceTriggerCard('building_insight_detected')
          .trigger(this.device, {
            category: insight.category,
            insight: insight.insight,
            recommendation: insight.recommendation,
            priority: insight.priority,
            confidence: insight.confidence,
            estimated_savings_eur_month: insight.estimatedSavings || 0,
          });

        this.logger(`BuildingInsightsService: Triggered insight_detected flow card for ${insight.category}`);
      }
    } catch (error) {
      this.logger('BuildingInsightsService: Error triggering flow card:', error);
    }
  }

  /**
   * Update insight capabilities - one capability per category (v2.5.10+)
   *
   * Maps each insight category to its dedicated capability:
   * - insulation_performance → building_insight_insulation
   * - pre_heating → building_insight_preheating
   * - thermal_storage → building_insight_thermal_storage
   * - profile_mismatch → building_insight_profile
   *
   * Always shows status (learning/issue/optimal), never empty
   */
  private async updateInsightCapabilities(): Promise<void> {
    try {
      // Category to capability mapping
      const categoryCapabilityMap: Record<InsightCategory, string> = {
        insulation_performance: 'building_insight_insulation',
        pre_heating: 'building_insight_preheating',
        thermal_storage: 'building_insight_thermal_storage',
        profile_mismatch: 'building_insight_profile',
      };

      // Update each capability with its category's insight
      for (const [category, capabilityId] of Object.entries(categoryCapabilityMap)) {
        if (this.device.hasCapability(capabilityId)) {
          const insight = this.activeInsights.get(category as InsightCategory);
          // Always show insight if available (learning/issue/optimal status)
          const value = insight ? insight.insight : '';
          await this.device.setCapabilityValue(capabilityId, value);
        } else {
          this.logger(`BuildingInsightsService: Capability ${capabilityId} not found (migration pending)`);
        }
      }

      // Update diagnostics JSON
      await this.updateDiagnosticsCapability();

      const totalCount = this.activeInsights.size;
      const activeCount = Array.from(this.activeInsights.values()).filter((i) => i.status === 'active').length;
      this.logger(`BuildingInsightsService: Updated ${Object.keys(categoryCapabilityMap).length} category capabilities (${totalCount} displayed, ${activeCount} triggered flow cards)`);
    } catch (error) {
      this.logger('BuildingInsightsService: Error updating capabilities:', error);
    }
  }

  /**
   * Update diagnostics capability with full insight state (JSON)
   */
  private async updateDiagnosticsCapability(): Promise<void> {
    if (!this.device.hasCapability('building_insights_diagnostics')) {
      return;
    }

    const diagnostics = {
      active_insights: Array.from(this.activeInsights.values()).filter((i) => i.status === 'active'),
      insight_history: this.insightHistory.slice(-10), // Last 10
      settings: {
        enabled: this.enabled,
        min_confidence: this.minConfidence,
        // Note: max_active_insights removed in v2.5.10 - each category has dedicated capability
      },
      last_evaluation: this.lastEvaluationTime ? new Date(this.lastEvaluationTime).toISOString() : null,
    };

    await this.device.setCapabilityValue('building_insights_diagnostics', JSON.stringify(diagnostics, null, 2));
  }

  /**
   * Schedule daily pre-heat recommendation trigger (23:00)
   */
  private schedulePreHeatRecommendation(): void {
    // Calculate milliseconds until next 23:00
    const now = new Date();
    const next23 = new Date();
    next23.setHours(23, 0, 0, 0);

    if (now.getHours() >= 23) {
      // Already past 23:00 today, schedule for tomorrow
      next23.setDate(next23.getDate() + 1);
    }

    const msUntil23 = next23.getTime() - now.getTime();

    // Schedule first trigger
    this.device.homey.setTimeout(() => {
      this.triggerPreHeatRecommendation().catch((err) => this.logger('BuildingInsightsService: Pre-heat trigger error:', err));

      // Schedule daily repeating trigger
      this.preHeatRecommendationTimer = this.device.homey.setInterval(
        () => this.triggerPreHeatRecommendation().catch((err) => this.logger('BuildingInsightsService: Pre-heat trigger error:', err)),
        24 * 60 * 60 * 1000, // 24 hours
      );
    }, msUntil23);

    this.logger(`BuildingInsightsService: Pre-heat recommendation scheduled for ${next23.toISOString()}`);
  }

  /**
   * Trigger pre-heat recommendation flow card
   * - Calculate optimal pre-heat duration based on τ
   * - Suggest start time based on wake time setting
   */
  private async triggerPreHeatRecommendation(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const model = this.buildingModel.getLearner().getModel();
    const diagnostics = await this.buildingModel.getDiagnosticStatus();

    if (diagnostics.confidence < this.minConfidence) {
      this.logger('BuildingInsightsService: Insufficient confidence for pre-heat recommendation');
      return;
    }

    // Defensive: Validate C and UA
    if (!Number.isFinite(model.C) || model.C <= 0 || !Number.isFinite(model.UA) || model.UA <= 0) {
      this.logger('BuildingInsightsService: Invalid model parameters for pre-heat recommendation');
      return;
    }

    const tau = model.C / model.UA;

    // Defensive: Validate tau
    if (!Number.isFinite(tau) || tau < 0.5 || tau > 100) {
      this.logger('BuildingInsightsService: Invalid tau for pre-heat recommendation:', tau);
      return;
    }

    const wakeTime = this.device.getSetting('wake_time') || '07:00';
    const desiredTempRise = this.device.getSetting('night_setback_delta') || 4.0;

    // Defensive: Validate wake_time format (HH:MM)
    const wakeTimeMatch = /^(\d{1,2}):(\d{2})$/.exec(wakeTime);
    if (!wakeTimeMatch) {
      this.logger('BuildingInsightsService: Invalid wake_time format:', wakeTime);
      return;
    }

    // Defensive: Validate desiredTempRise is reasonable (2-6°C)
    if (typeof desiredTempRise !== 'number' || desiredTempRise < 2 || desiredTempRise > 6) {
      this.logger('BuildingInsightsService: Invalid night_setback_delta:', desiredTempRise);
      return;
    }

    // Calculate optimal pre-heat duration: τ × ln(ΔT_target / ΔT_residual)
    const preHeatHours = tau * Math.log(desiredTempRise / 0.5); // 0.5°C residual

    // Defensive: Validate preHeatHours is reasonable (0.5h - 24h)
    if (!Number.isFinite(preHeatHours) || preHeatHours < 0.5 || preHeatHours > 24) {
      this.logger('BuildingInsightsService: Invalid preHeatHours calculated:', preHeatHours);
      return;
    }

    const wakeHour = parseInt(wakeTimeMatch[1], 10);
    const wakeMinute = parseInt(wakeTimeMatch[2], 10);

    let startHour = wakeHour - Math.floor(preHeatHours);
    let startMinute = wakeMinute - Math.round((preHeatHours % 1) * 60);

    if (startMinute < 0) {
      startMinute += 60;
      startHour -= 1;
    }
    if (startHour < 0) startHour += 24;

    const startTime = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;

    try {
      await this.device.homey.flow
        .getDeviceTriggerCard('pre_heat_recommendation')
        .trigger(this.device, {
          start_time: startTime,
          target_time: wakeTime,
          duration_hours: Math.round(preHeatHours * 10) / 10,
          temp_rise: desiredTempRise,
          confidence: diagnostics.confidence,
        });

      this.logger(`BuildingInsightsService: Triggered pre_heat_recommendation: start=${startTime}, duration=${preHeatHours.toFixed(1)}h`);
    } catch (error) {
      this.logger('BuildingInsightsService: Error triggering pre-heat recommendation:', error);
    }
  }

  /**
   * Find closest building profile based on learned parameters
   */
  private findClosestProfile(model: { C: number; UA: number }): BuildingProfileType {
    // Defensive: Validate input parameters
    if (!Number.isFinite(model.C) || model.C <= 0 || !Number.isFinite(model.UA) || model.UA <= 0) {
      this.logger('BuildingInsightsService: Invalid model for profile matching, defaulting to average');
      return 'average';
    }

    const learnedTau = model.C / model.UA;

    // Defensive: Validate calculated tau
    if (!Number.isFinite(learnedTau) || learnedTau <= 0) {
      this.logger('BuildingInsightsService: Invalid learnedTau for profile matching, defaulting to average');
      return 'average';
    }

    let closestProfile: BuildingProfileType = 'average';
    let minDeviation = Infinity;

    for (const [profileName, params] of Object.entries(BUILDING_PROFILES)) {
      // Defensive: Validate profile parameters
      if (!params || typeof params.C !== 'number' || typeof params.UA !== 'number' || params.UA <= 0) {
        continue; // Skip invalid profiles
      }

      const profileTau = params.C / params.UA;

      // Defensive: Skip if profileTau is invalid
      if (!Number.isFinite(profileTau) || profileTau <= 0) {
        continue;
      }

      const deviation = Math.abs(learnedTau - profileTau);
      if (deviation < minDeviation) {
        minDeviation = deviation;
        closestProfile = profileName as BuildingProfileType;
      }
    }

    return closestProfile;
  }

  /**
   * Estimate insulation savings (EUR/month)
   * - Calculate excess heat loss
   * - Apply typical heating hours and COP
   * - Convert to monthly cost
   */
  private estimateInsulationSavings(actualUA: number, targetUA: number): number {
    // Defensive: Validate inputs
    if (!Number.isFinite(actualUA) || !Number.isFinite(targetUA) || actualUA <= 0 || targetUA <= 0) {
      this.logger('BuildingInsightsService: Invalid UA values for savings estimation');
      return 0;
    }

    const excessHeatLoss = actualUA - targetUA; // kW/°C

    // No savings if already better than target
    if (excessHeatLoss <= 0) {
      return 0;
    }

    const avgTempDiff = 15; // Average indoor-outdoor delta (°C)
    const heatingHours = 4000; // Annual heating hours (typical)
    const avgCOP = 3.5;
    const energyPrice = 0.30; // €/kWh

    const annualExcessEnergy = (excessHeatLoss * avgTempDiff * heatingHours) / avgCOP; // kWh
    const annualCost = annualExcessEnergy * energyPrice;
    const monthlySavings = annualCost / 12;

    // Defensive: Validate result is reasonable (0-500 EUR/month)
    if (!Number.isFinite(monthlySavings) || monthlySavings < 0 || monthlySavings > 500) {
      this.logger('BuildingInsightsService: Unrealistic insulation savings calculated:', monthlySavings);
      return 0;
    }

    return Math.round(monthlySavings);
  }

  /**
   * Estimate thermal storage savings (EUR/month)
   * - Calculate stored energy capacity
   * - Apply price differential between peak/off-peak
   * - Apply utilization factor
   */
  private estimateThermalStorageSavings(C: number, tau: number): number {
    // Defensive: Validate inputs
    if (!Number.isFinite(C) || C <= 0 || !Number.isFinite(tau) || tau <= 0) {
      this.logger('BuildingInsightsService: Invalid C or tau for thermal storage savings');
      return 0;
    }

    const avgTempShift = 2.0; // °C shift during cheap hours
    const storedEnergy = C * avgTempShift; // kWh stored

    // Defensive: Validate stored energy is reasonable (should be < 200 kWh for residential)
    if (!Number.isFinite(storedEnergy) || storedEnergy <= 0 || storedEnergy > 200) {
      this.logger('BuildingInsightsService: Unrealistic stored energy calculated:', storedEnergy);
      return 0;
    }

    const dailyStorageCycles = 1; // Once per day
    const priceDifferential = 0.15; // €/kWh (peak - off-peak)
    const utilizationFactor = 0.7; // 70% of stored energy used during peak

    const dailySavings = storedEnergy * dailyStorageCycles * priceDifferential * utilizationFactor;
    const monthlySavings = dailySavings * 30;

    // Defensive: Validate result is reasonable (0-300 EUR/month)
    if (!Number.isFinite(monthlySavings) || monthlySavings < 0 || monthlySavings > 300) {
      this.logger('BuildingInsightsService: Unrealistic thermal storage savings calculated:', monthlySavings);
      return 0;
    }

    return Math.round(monthlySavings);
  }

  /**
   * Persist current state to device store
   */
  private async persistState(): Promise<void> {
    const state: InsightState = {
      activeInsights: Array.from(this.activeInsights.values()),
      history: this.insightHistory.slice(-50), // Keep last 50
      lastEvaluation: this.lastEvaluationTime,
    };

    await this.device.setStoreValue('building_insights_state', state);
    this.logger('BuildingInsightsService: State persisted');
  }

  /**
   * Restore state from device store
   */
  private async restoreState(): Promise<void> {
    const state = await this.device.getStoreValue('building_insights_state') as InsightState | null;
    if (state) {
      this.activeInsights = new Map(state.activeInsights.map((i) => [i.category, i]));
      this.insightHistory = state.history || [];
      this.lastEvaluationTime = state.lastEvaluation || 0;
      this.logger(`BuildingInsightsService: Restored ${this.activeInsights.size} active insights from storage`);
    }
  }

  // ==================== PUBLIC API FOR FLOW CARDS ====================

  /**
   * Flow Action: Force immediate insight analysis
   * Used by: force_insight_analysis flow action card
   * @returns Object with insights_detected and confidence for flow tokens
   */
  public async forceInsightAnalysis(): Promise<{ insights_detected: number; confidence: number }> {
    this.logger('BuildingInsightsService: Force insight analysis triggered');

    await this.evaluateInsights();

    const diagnostics = await this.buildingModel.getDiagnosticStatus();
    const insightsCount = Array.from(this.activeInsights.values()).filter((i) => i.status === 'active').length;

    return {
      insights_detected: insightsCount,
      confidence: diagnostics.confidence,
    };
  }

  /**
   * Flow Condition: Check if specific insight category is active
   * Used by: insight_is_active flow condition card
   */
  public isInsightActive(category: InsightCategory): boolean {
    const insight = this.activeInsights.get(category);

    // Active if exists, status is 'active', and not dismissed
    if (!insight) {
      return false;
    }

    if (insight.status !== 'active') {
      return false;
    }

    // Check if still dismissed
    if (insight.dismissedUntil && Date.now() < insight.dismissedUntil) {
      return false;
    }

    return true;
  }

  /**
   * Flow Condition: Check if model confidence is above threshold
   * Used by: confidence_above flow condition card
   */
  public async isConfidenceAbove(threshold: number): Promise<boolean> {
    // Defensive: Validate threshold
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      this.logger('BuildingInsightsService: Invalid confidence threshold for condition:', threshold);
      return false;
    }

    try {
      const diagnostics = await this.buildingModel.getDiagnosticStatus();
      return diagnostics.confidence > threshold;
    } catch (error) {
      this.logger('BuildingInsightsService: Error checking confidence:', error);
      return false;
    }
  }

  /**
   * Flow Condition: Check if savings for a category are above threshold
   * Used by: savings_above flow condition card
   */
  public areSavingsAbove(category: InsightCategory, threshold: number): boolean {
    // Defensive: Validate threshold
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 500) {
      this.logger('BuildingInsightsService: Invalid savings threshold for condition:', threshold);
      return false;
    }

    const insight = this.activeInsights.get(category);

    if (!insight) {
      return false; // No insight = no savings
    }

    if (insight.status !== 'active') {
      return false; // Dismissed insight = don't consider savings
    }

    // estimatedSavings is optional (profile_mismatch doesn't have savings)
    const savings = insight.estimatedSavings || 0;

    return savings > threshold;
  }

  /**
   * Public API: Get learner (for external access)
   */
  public getBuildingModel(): BuildingModelService {
    return this.buildingModel;
  }
}
