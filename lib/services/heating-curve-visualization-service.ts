/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import Homey from 'homey';

export interface HeatingCurveVisualizationOptions {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

/**
 * HeatingCurveVisualizationService (v2.3.7)
 *
 * Manages dynamic SVG visualization of the linear heating curve formula.
 * Uses Homey's Image API to generate and update visual representations
 * of the heating curve based on stored parameters.
 *
 * Features:
 * - SVG generation with formula display and graphical curve
 * - Automatic updates when curve parameters change
 * - Reference point marker and grid lines
 * - Temperature range: -20°C to +20°C outdoor, 0°C to 70°C supply
 */
export class HeatingCurveVisualizationService {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private heatingCurveImage: Homey.Image | null = null;
  private isInitialized = false;

  constructor(options: HeatingCurveVisualizationOptions) {
    this.device = options.device;
    this.logger = options.logger || (() => {});
  }

  /**
   * Initialize the service and create the Image object
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger('HeatingCurveVisualizationService already initialized');
      return;
    }

    try {
      // Create the Image object using Homey's Image API
      this.heatingCurveImage = await this.device.homey.images.createImage();

      // Set up the stream for dynamic SVG generation
      this.heatingCurveImage.setStream(async (stream: NodeJS.WritableStream) => {
        const svgContent = this.generateHeatingCurveSVG();
        stream.write(Buffer.from(svgContent, 'utf-8'));
        stream.end();
      });

      this.isInitialized = true;
      this.logger('HeatingCurveVisualizationService initialized successfully');

      // Generate initial visualization
      await this.updateVisualization();
    } catch (error) {
      this.logger('Failed to initialize HeatingCurveVisualizationService:', error);
      throw error;
    }
  }

  /**
   * Update the heating curve visualization
   * Call this when curve parameters change
   */
  async updateVisualization(): Promise<void> {
    if (!this.isInitialized || !this.heatingCurveImage) {
      this.logger('Cannot update visualization - service not initialized');
      return;
    }

    try {
      // Notify Homey that the image content has changed
      await this.heatingCurveImage.update();
      this.logger('Heating curve visualization updated');
    } catch (error) {
      this.logger('Failed to update heating curve visualization:', error);
    }
  }

  /**
   * Get the Image object for use in capabilities
   */
  getImage(): Homey.Image | null {
    return this.heatingCurveImage;
  }

  /**
   * Generate SVG visualization of heating curve
   * Creates a visual representation of the linear heating curve formula
   */
  private generateHeatingCurveSVG(): string {
    const slope = this.device.getCapabilityValue('heating_curve_slope') ?? -0.5;
    const intercept = this.device.getCapabilityValue('heating_curve_intercept') ?? 47.5;
    const refTemp = this.device.getCapabilityValue('heating_curve_ref_temp') ?? 55;
    const refOutdoor = this.device.getCapabilityValue('heating_curve_ref_outdoor') ?? -15;
    const formula = this.device.getCapabilityValue('heating_curve_formula') ?? `y = ${slope}x + ${intercept}`;

    // SVG canvas size
    const width = 500;
    const height = 350;
    const padding = 60;

    // Temperature ranges
    const minOutdoor = -20;
    const maxOutdoor = 20;
    const minSupply = 0;
    const maxSupply = 70;

    // Calculate scale factors
    const xScale = (width - 2 * padding) / (maxOutdoor - minOutdoor);
    const yScale = (height - 2 * padding) / (maxSupply - minSupply);

    // Helper function to convert temp to SVG coordinates
    const toX = (outdoor: number) => padding + (outdoor - minOutdoor) * xScale;
    const toY = (supply: number) => height - padding - (supply - minSupply) * yScale;

    // Calculate curve points
    const points: string[] = [];
    for (let outdoor = minOutdoor; outdoor <= maxOutdoor; outdoor += 0.5) {
      const supply = slope * outdoor + intercept;
      // Clamp supply temperature to visible range
      const clampedSupply = Math.max(minSupply, Math.min(maxSupply, supply));
      points.push(`${toX(outdoor)},${toY(clampedSupply)}`);
    }

    // Generate grid lines
    const gridLines: string[] = [];

    // Vertical grid lines (every 10°C outdoor)
    for (let temp = -20; temp <= 20; temp += 10) {
      const x = toX(temp);
      gridLines.push(`<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" stroke="#E0E0E0" stroke-width="1"/>`);
      gridLines.push(`<text x="${x}" y="${height - padding + 20}" text-anchor="middle" font-size="11" fill="#666">${temp}°C</text>`);
    }

    // Horizontal grid lines (every 10°C supply)
    for (let temp = 0; temp <= 70; temp += 10) {
      const y = toY(temp);
      gridLines.push(`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#E0E0E0" stroke-width="1"/>`);
      gridLines.push(`<text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${temp}</text>`);
    }

    // Reference point coordinates
    const refX = toX(refOutdoor);
    const refY = toY(refTemp);

    const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white"/>

  <!-- Title -->
  <text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">Verwarmingscurve Visualisatie</text>

  <!-- Grid lines -->
  ${gridLines.join('\n  ')}

  <!-- Axes -->
  <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#333" stroke-width="2"/>
  <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#333" stroke-width="2"/>

  <!-- Axis labels -->
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="13" font-weight="bold" fill="#333">Buitentemperatuur (°C)</text>
  <text x="20" y="${height / 2}" text-anchor="middle" font-size="13" font-weight="bold" fill="#333" transform="rotate(-90 20 ${height / 2})">Aanvoertemperatuur (°C)</text>

  <!-- Heating curve line -->
  <polyline points="${points.join(' ')}" fill="none" stroke="#FF6B35" stroke-width="3"/>

  <!-- Reference point marker -->
  <circle cx="${refX}" cy="${refY}" r="6" fill="#FF6B35" stroke="white" stroke-width="2"/>
  <circle cx="${refX}" cy="${refY}" r="8" fill="none" stroke="#FF6B35" stroke-width="2"/>
  <text x="${refX + 12}" y="${refY - 12}" font-size="11" fill="#333" font-weight="bold">Referentiepunt:</text>
  <text x="${refX + 12}" y="${refY}" font-size="11" fill="#333">${refTemp}°C @ ${refOutdoor}°C</text>

  <!-- Formula display box -->
  <rect x="15" y="40" width="200" height="35" fill="#F5F5F5" stroke="#333" stroke-width="1.5" rx="5"/>
  <text x="115" y="58" text-anchor="middle" font-size="14" fill="#666">Formule:</text>
  <text x="115" y="70" text-anchor="middle" font-size="16" font-weight="bold" fill="#FF6B35">${formula}</text>
</svg>`;

    return svg;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.heatingCurveImage) {
      try {
        await this.heatingCurveImage.unregister();
        this.logger('Heating curve image unregistered');
      } catch (error) {
        this.logger('Error unregistering heating curve image:', error);
      }
      this.heatingCurveImage = null;
    }

    this.isInitialized = false;
    this.logger('HeatingCurveVisualizationService destroyed');
  }
}
