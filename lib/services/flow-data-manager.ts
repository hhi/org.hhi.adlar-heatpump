/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */

/**
 * Flow-Based External Data Manager
 * Uses Homey's flow card system for reliable cross-app communication
 * This approach works within Homey's security model and provides user control
 */

/**
 * External data configuration
 */
export interface FlowDataConfig {
  powerEnabled: boolean;
  flowEnabled: boolean;
  ambientEnabled: boolean;
  requestTimeoutMs: number;
}

/**
 * External data received from flow cards
 */
export interface FlowDataResult {
  electricalPower?: { value: number; source: string; timestamp: number };
  waterFlowRate?: { value: number; source: string; timestamp: number };
  ambientTemperature?: { value: number; source: string; timestamp: number };
  requestTimestamp: number;
  responseCount: number;
  errors: string[];
}

/**
 * Pending data request tracking
 */
interface PendingRequest {
  id: string;
  type: 'power' | 'flow' | 'ambient';
  timestamp: number;
  timeout: NodeJS.Timeout;
  resolve: (data: any) => void;
}

/**
 * FlowDataManager - manages external data collection through flow cards
 * Uses Homey's flow system as a communication bridge between apps
 */
export class FlowDataManager {
  private homey: any;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private lastReceivedData: FlowDataResult | null = null;

  constructor(homey: any) {
    this.homey = homey;
    this.setupFlowCardListeners();
  }

  /**
   * Setup flow card listeners for data requests and responses
   */
  private setupFlowCardListeners(): void {
    try {
      // Register trigger cards for requesting external data
      this.homey.flow.getTriggerCard('request_external_power_data')
        .register();

      this.homey.flow.getTriggerCard('request_external_flow_data')
        .register();

      this.homey.flow.getTriggerCard('request_external_ambient_data')
        .register();

      // Register action cards for receiving external data
      this.homey.flow.getActionCard('receive_external_power_data')
        .registerRunListener(async (args: any) => {
          await this.handleReceivedPowerData(args);
        });

      this.homey.flow.getActionCard('receive_external_flow_data')
        .registerRunListener(async (args: any) => {
          await this.handleReceivedFlowData(args);
        });

      this.homey.flow.getActionCard('receive_external_ambient_data')
        .registerRunListener(async (args: any) => {
          await this.handleReceivedAmbientData(args);
        });

      this.homey.log('✅ Flow card listeners registered successfully');
    } catch (error) {
      this.homey.error('❌ Failed to register flow card listeners:', error);
    }
  }

  /**
   * Request external device data using flow card system
   */
  public async getExternalDeviceData(config: FlowDataConfig): Promise<FlowDataResult> {
    const result: FlowDataResult = {
      requestTimestamp: Date.now(),
      responseCount: 0,
      errors: [],
    };

    const promises: Promise<any>[] = [];

    // Request power data if enabled
    if (config.powerEnabled) {
      promises.push(this.requestPowerData(config.requestTimeoutMs));
    }

    // Request flow data if enabled
    if (config.flowEnabled) {
      promises.push(this.requestFlowData(config.requestTimeoutMs));
    }

    // Request ambient data if enabled
    if (config.ambientEnabled) {
      promises.push(this.requestAmbientData(config.requestTimeoutMs));
    }

    // Wait for all requests to complete or timeout
    const responses = await Promise.allSettled(promises);

    // Process responses
    responses.forEach((response, index) => {
      const dataType = ['power', 'flow', 'ambient'][index];

      if (response.status === 'fulfilled' && response.value) {
        result.responseCount++;
        const data = response.value;

        switch (dataType) {
          case 'power':
            result.electricalPower = data;
            break;
          case 'flow':
            result.waterFlowRate = data;
            break;
          case 'ambient':
            result.ambientTemperature = data;
            break;
        }
      } else {
        const error = response.status === 'rejected'
          ? response.reason
          : `No ${dataType} data received`;
        result.errors.push(`${dataType}: ${error}`);
      }
    });

    this.lastReceivedData = result;
    return result;
  }

  /**
   * Request power data via flow trigger
   */
  private async requestPowerData(timeoutMs: number): Promise<{ value: number; source: string; timestamp: number } | null> {
    return this.makeFlowRequest('power', 'request_external_power_data', timeoutMs);
  }

  /**
   * Request flow data via flow trigger
   */
  private async requestFlowData(timeoutMs: number): Promise<{ value: number; source: string; timestamp: number } | null> {
    return this.makeFlowRequest('flow', 'request_external_flow_data', timeoutMs);
  }

  /**
   * Request ambient data via flow trigger
   */
  private async requestAmbientData(timeoutMs: number): Promise<{ value: number; source: string; timestamp: number } | null> {
    return this.makeFlowRequest('ambient', 'request_external_ambient_data', timeoutMs);
  }

  /**
   * Make a flow-based data request with timeout
   */
  private async makeFlowRequest(
    type: 'power' | 'flow' | 'ambient',
    triggerCardId: string,
    timeoutMs: number,
  ): Promise<{ value: number; source: string; timestamp: number } | null> {
    const requestId = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Promise((resolve) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve(null);
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(requestId, {
        id: requestId,
        type,
        timestamp: Date.now(),
        timeout,
        resolve,
      });

      // Trigger flow card
      this.homey.flow.getTriggerCard(triggerCardId)
        .trigger(null, {
          request_id: requestId,
          requester: 'heat_pump_app',
          timestamp: Date.now(),
        })
        .catch((error: any) => {
          this.homey.error(`Failed to trigger ${triggerCardId}:`, error);
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          resolve(null);
        });
    });
  }

  /**
   * Handle received power data from flow action
   */
  private async handleReceivedPowerData(args: any): Promise<void> {
    const { request_id, power_value, device_name } = args;

    if (this.pendingRequests.has(request_id)) {
      const request = this.pendingRequests.get(request_id)!;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(request_id);

      const data = {
        value: Number(power_value),
        source: device_name || 'external_device',
        timestamp: Date.now(),
      };

      request.resolve(data);
      this.homey.log(`✅ Received power data: ${power_value}W from ${device_name}`);
    }
  }

  /**
   * Handle received flow data from flow action
   */
  private async handleReceivedFlowData(args: any): Promise<void> {
    const { request_id, flow_value, device_name } = args;

    if (this.pendingRequests.has(request_id)) {
      const request = this.pendingRequests.get(request_id)!;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(request_id);

      const data = {
        value: Number(flow_value),
        source: device_name || 'external_device',
        timestamp: Date.now(),
      };

      request.resolve(data);
      this.homey.log(`✅ Received flow data: ${flow_value}L/min from ${device_name}`);
    }
  }

  /**
   * Handle received ambient data from flow action
   */
  private async handleReceivedAmbientData(args: any): Promise<void> {
    const { request_id, temperature_value, device_name } = args;

    if (this.pendingRequests.has(request_id)) {
      const request = this.pendingRequests.get(request_id)!;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(request_id);

      const data = {
        value: Number(temperature_value),
        source: device_name || 'external_device',
        timestamp: Date.now(),
      };

      request.resolve(data);
      this.homey.log(`✅ Received ambient data: ${temperature_value}°C from ${device_name}`);
    }
  }

  /**
   * Get the last received external data (for caching/fallback)
   */
  public getLastReceivedData(): FlowDataResult | null {
    return this.lastReceivedData;
  }

  /**
   * Test flow card connectivity
   */
  public async testFlowConnectivity(): Promise<{
    powerFlowActive: boolean;
    flowFlowActive: boolean;
    ambientFlowActive: boolean;
    testDuration: number;
  }> {
    const testStartTime = Date.now();
    const testConfig: FlowDataConfig = {
      powerEnabled: true,
      flowEnabled: true,
      ambientEnabled: true,
      requestTimeoutMs: 5000, // Short timeout for testing
    };

    const result = await this.getExternalDeviceData(testConfig);

    return {
      powerFlowActive: !!result.electricalPower,
      flowFlowActive: !!result.waterFlowRate,
      ambientFlowActive: !!result.ambientTemperature,
      testDuration: Date.now() - testStartTime,
    };
  }

  /**
   * Cleanup pending requests on shutdown
   */
  public cleanup(): void {
    this.pendingRequests.forEach((request) => {
      clearTimeout(request.timeout);
    });
    this.pendingRequests.clear();
    this.homey.log('🧹 FlowDataManager cleaned up pending requests');
  }
}