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
  private maxActiveInsights: number = 3;

  // Timers
  private evaluationTimer: NodeJS.Timeout | null = null;
  private preHeatRecommendationTimer: NodeJS.Timeout | null = null;
  private readonly EVALUATION_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes (10 samples @ 5min)

  constructor(config: BuildingInsightsServiceConfig) {
    this.device = config.device;
    this.buildingModel = config.buildingModelService;
    this.adaptiveControl = config.adaptiveControlService;
    this.logger = config.logger || (() => {});

    // Load settings
    this.enabled = this.device.getSetting('insights_enabled') ?? true;
    this.minConfidence = this.device.getSetting('insights_min_confidence') ?? 70;
    this.maxActiveInsights = this.device.getSetting('insights_max_active') ?? 3;
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

    // Update capabilities with current insights
    await this.updateInsightCapabilities();

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

    if (typeof settings.insights_enabled === 'boolean') {
      this.enabled = settings.insights_enabled;
      configChanged = true;
    }

    if (typeof settings.insights_min_confidence === 'number') {
      this.minConfidence = settings.insights_min_confidence;
      configChanged = true;
    }

    if (typeof settings.insights_max_active === 'number') {
      this.maxActiveInsights = settings.insights_max_active;
      configChanged = true;
    }

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
      // Check if we should trigger this insight (advice fatigue prevention)
      if (this.shouldTriggerInsight(insight)) {
        // Update status
        this.updateInsightStatus(insight);

        // Trigger appropriate flow card
        await this.triggerInsightFlowCard(insight);

        // Add to active insights
        this.activeInsights.set(insight.category, insight);

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
   * - Requires 70% model confidence
   */
  private detectInsulationInsights(diagnostics: BuildingModelDiagnostics): Insight | null {
    const model = this.buildingModel.getLearner().getModel();

    // Require high confidence
    if (diagnostics.confidence < this.minConfidence) {
      return null;
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
      return {
        id: `insulation_poor_${Date.now()}`,
        category: 'insulation_performance',
        priority: 85,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: `🏠 High heat loss - UA ${model.UA.toFixed(2)} kW/°C (expected: ${expectedUA.toFixed(2)})`,
        recommendation: `Consider insulation upgrades: roof (25% savings), walls (15%), windows (10%). Est. savings: €${savingsEstimate}/month`,
        estimatedSavings: savingsEstimate,
        status: 'new',
      };
    }

    // Good insulation (informational only - low priority)
    if (model.UA < expectedUA * 0.7) {
      return {
        id: `insulation_good_${Date.now()}`,
        category: 'insulation_performance',
        priority: 30,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: `✅ Excellent insulation - UA ${model.UA.toFixed(2)} kW/°C`,
        recommendation: 'Building is well-optimized, continue current strategy',
        status: 'new',
      };
    }

    return null; // Average insulation, no insight
  }

  /**
   * Detect pre-heating strategy insights
   * - Categorize thermal response speed (fast/medium/slow)
   * - Suggest optimal night setback strategy
   * - Requires 70% model confidence
   */
  private detectPreHeatingInsights(diagnostics: BuildingModelDiagnostics): Insight | null {
    const model = this.buildingModel.getLearner().getModel();

    if (diagnostics.confidence < this.minConfidence) {
      return null;
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

    // Defensive: Validate tau is finite and in reasonable range (0.5h - 100h)
    if (!Number.isFinite(tau) || tau < 0.5 || tau > 100) {
      this.logger('BuildingInsightsService: Invalid tau calculated for pre-heating:', tau);
      return null;
    }

    // Categorize thermal response
    let category: string;
    let recommendation: string;
    let priority: number;

    if (tau < 5) {
      category = 'fast_response';
      priority = 75;
      recommendation = `Fast thermal response (${tau.toFixed(1)}h) - enable aggressive night setback to 16°C, pre-heat 2 hours before wake time. Est. 12% energy savings.`;
    } else if (tau < 15) {
      category = 'medium_response';
      priority = 60;
      recommendation = `Medium thermal response (${tau.toFixed(1)}h) - moderate night setback to 17°C, pre-heat 4 hours before wake time. Est. 8% energy savings.`;
    } else {
      category = 'slow_response';
      priority = 50;
      recommendation = `Slow thermal response (${tau.toFixed(1)}h) - minimal setback to 18°C, pre-heat 6+ hours before wake time. Consider continuous heating.`;
    }

    return {
      id: `pre_heating_${category}_${Date.now()}`,
      category: 'pre_heating',
      priority,
      confidence: diagnostics.confidence,
      detectedAt: Date.now(),
      insight: `⏱️ ${category.replace('_', ' ')} - τ=${tau.toFixed(1)}h`,
      recommendation,
      status: 'new',
    };
  }

  /**
   * Detect thermal storage optimization insights
   * - Check for high thermal mass + slow response
   * - Verify dynamic pricing availability
   * - Calculate potential savings from load shifting
   * - Requires 70% model confidence
   */
  private detectThermalStorageInsights(diagnostics: BuildingModelDiagnostics): Insight | null {
    const model = this.buildingModel.getLearner().getModel();

    if (diagnostics.confidence < this.minConfidence) {
      return null;
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
        return {
          id: `thermal_storage_active_${Date.now()}`,
          category: 'thermal_storage',
          priority: 90,
          confidence: diagnostics.confidence,
          detectedAt: Date.now(),
          insight: `💰 Thermal storage potential - C=${model.C.toFixed(0)} kWh/°C, τ=${tau.toFixed(1)}h`,
          recommendation: `Pre-heat +2°C during cheap hours (02:00-06:00), coast at -1°C during peak (17:00-21:00). Est. savings: €${savingsEstimate}/month`,
          estimatedSavings: savingsEstimate,
          status: 'new',
        };
      }
      // Potential exists but dynamic pricing not configured
      return {
        id: `thermal_storage_potential_${Date.now()}`,
        category: 'thermal_storage',
        priority: 65,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: `💡 Building suitable for thermal storage - C=${model.C.toFixed(0)} kWh/°C, τ=${tau.toFixed(1)}h`,
        recommendation: 'Add dynamic energy pricing data via flow card "Receive external energy prices" to enable cost optimization. Potential savings: 15-25%',
        status: 'new',
      };
    }

    return null;
  }

  /**
   * Detect building profile mismatch
   * - Compare learned τ with profile τ
   * - Suggest optimal profile for faster learning
   * - Requires 50% model confidence (lower threshold for rough detection)
   */
  private detectProfileMismatch(diagnostics: BuildingModelDiagnostics): Insight | null {
    const model = this.buildingModel.getLearner().getModel();

    // Lower confidence threshold for rough detection
    if (diagnostics.confidence < 50) {
      return null;
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

      return {
        id: `profile_mismatch_${Date.now()}`,
        category: 'profile_mismatch',
        priority: 40,
        confidence: diagnostics.confidence,
        detectedAt: Date.now(),
        insight: `🔄 Building behaves like '${suggestedProfile}' (τ=${learnedTau.toFixed(1)}h vs '${currentProfile}' τ=${profileTau.toFixed(1)}h)`,
        recommendation: `Change building profile to '${suggestedProfile}' in device settings for faster learning and better initial parameters`,
        status: 'new',
      };
    }

    return null;
  }

  /**
   * Prioritize insights by priority score
   * - Sort by priority (high to low)
   * - Limit to maxActiveInsights
   */
  private prioritizeInsights(insights: Insight[]): Insight[] {
    return insights
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.maxActiveInsights);
  }

  /**
   * Check if insight should trigger (advice fatigue prevention)
   * - Check if dismissed
   * - Check if already triggered recently (24h)
   * - Check if parameters changed significantly (>10% drift)
   */
  private shouldTriggerInsight(insight: Insight): boolean {
    // Check if dismissed
    const existingInsight = this.activeInsights.get(insight.category);
    if (existingInsight?.dismissedUntil && Date.now() < existingInsight.dismissedUntil) {
      this.logger(`BuildingInsightsService: Insight ${insight.category} dismissed until ${new Date(existingInsight.dismissedUntil).toISOString()}`);
      return false;
    }

    // Check if already triggered recently (same category within 24 hours)
    const recentInsight = this.insightHistory.find(
      (h) => h.category === insight.category && Date.now() - h.detectedAt < 24 * 60 * 60 * 1000,
    );
    if (recentInsight) {
      this.logger(`BuildingInsightsService: Insight ${insight.category} already triggered within 24 hours`);
      return false;
    }

    // Check if parameters changed significantly (>10% drift)
    if (existingInsight) {
      const confidenceDrift = Math.abs(insight.confidence - existingInsight.confidence) / 100;
      if (confidenceDrift < 0.10) {
        this.logger(`BuildingInsightsService: Insight ${insight.category} no significant change (drift=${(confidenceDrift * 100).toFixed(1)}%)`);
        return false;
      }
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
   * Update insight capabilities (top 3 active insights)
   */
  private async updateInsightCapabilities(): Promise<void> {
    try {
      // Get top 3 insights sorted by priority
      const topInsights = Array.from(this.activeInsights.values())
        .filter((i) => i.status === 'active')
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3);

      // Defensive: Check capability exists before setting
      if (this.device.hasCapability('building_insight_primary')) {
        const value = topInsights.length > 0 ? topInsights[0].insight : '';
        await this.device.setCapabilityValue('building_insight_primary', value);
      } else {
        this.logger('BuildingInsightsService: WARNING - building_insight_primary capability missing');
      }

      if (this.device.hasCapability('building_insight_secondary')) {
        const value = topInsights.length > 1 ? topInsights[1].insight : '';
        await this.device.setCapabilityValue('building_insight_secondary', value);
      } else {
        this.logger('BuildingInsightsService: WARNING - building_insight_secondary capability missing');
      }

      if (this.device.hasCapability('building_insight_recommendation')) {
        const value = topInsights.length > 0 ? topInsights[0].recommendation : '';
        await this.device.setCapabilityValue('building_insight_recommendation', value);
      } else {
        this.logger('BuildingInsightsService: WARNING - building_insight_recommendation capability missing');
      }

      // Update diagnostics JSON
      await this.updateDiagnosticsCapability();

      this.logger(`BuildingInsightsService: Updated capabilities (${topInsights.length} active insights)`);
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
        max_active_insights: this.maxActiveInsights,
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

  /**
   * Public API: Dismiss insight for specified duration
   */
  public async dismissInsight(category: InsightCategory, durationDays: number): Promise<void> {
    const insight = this.activeInsights.get(category);
    if (insight) {
      insight.status = 'dismissed';
      insight.dismissedUntil = Date.now() + durationDays * 24 * 60 * 60 * 1000;
      await this.updateInsightCapabilities();
      await this.persistState();
      this.logger(`BuildingInsightsService: Dismissed ${category} for ${durationDays} days`);
    }
  }

  /**
   * Public API: Analyze performance now (on-demand evaluation)
   */
  public async analyzePerformanceNow(): Promise<Insight[]> {
    await this.evaluateInsights();
    return Array.from(this.activeInsights.values());
  }

  /**
   * Public API: Get learner (for external access)
   */
  public getBuildingModel(): BuildingModelService {
    return this.buildingModel;
  }
}
