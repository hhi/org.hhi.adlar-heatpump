#!/usr/bin/env node
/**
 * COP Calculation Debug Tool for Adlar Heat Pump
 * 
 * This script helps debug COP calculation issues by:
 * 1. Testing all three calculation methods with sample data
 * 2. Analyzing real device data from the heat pump
 * 3. Simulating different scenarios and edge cases
 * 4. Generating detailed debug reports
 * 
 * Usage:
 * node debug-cop.js [--method=METHOD] [--simulate] [--verbose]
 */

const { COPCalculator } = require('./lib/services/cop-calculator');
const { DeviceConstants } = require('./lib/constants');

// Sample test data sets for different scenarios
const testDataSets = {
  ideal_conditions: {
    name: "Ideal Operating Conditions",
    data: {
      electricalPower: 2500,          // 2.5kW electrical input
      waterFlowRate: 30,              // 30 L/min
      inletTemperature: 35,           // 35°C inlet
      outletTemperature: 45,          // 45°C outlet (10°C rise)
      ambientTemperature: 10,         // 10°C outside
      compressorFrequency: 80,        // 80Hz compressor
      isDefrosting: false,
      systemMode: "heating"
    },
    expectedCOP: { min: 3.5, max: 4.5 }
  },

  cold_weather: {
    name: "Cold Weather Operation",
    data: {
      electricalPower: 3200,          // Higher power consumption
      waterFlowRate: 25,              // Reduced flow
      inletTemperature: 30,           // Lower inlet temp
      outletTemperature: 38,          // Lower outlet temp
      ambientTemperature: -10,        // Very cold outside
      compressorFrequency: 95,        // High compressor frequency
      isDefrosting: false,
      systemMode: "heating"
    },
    expectedCOP: { min: 2.0, max: 3.0 }
  },

  defrost_mode: {
    name: "Defrost Mode",
    data: {
      electricalPower: 2800,
      waterFlowRate: 20,              // Reduced during defrost
      inletTemperature: 25,
      outletTemperature: 30,          // Lower temperature rise
      ambientTemperature: -5,
      compressorFrequency: 70,
      isDefrosting: true,             // Defrost active
      systemMode: "heating"
    },
    expectedCOP: { min: 1.0, max: 2.0 }
  },

  minimal_data: {
    name: "Minimal Data (Temperature Difference Only)",
    data: {
      inletTemperature: 32,
      outletTemperature: 42,          // 10°C difference
      isDefrosting: false
    },
    expectedCOP: { min: 2.0, max: 4.0 }
  },

  no_power_data: {
    name: "No Power Data (Carnot Estimation)",
    data: {
      outletTemperature: 45,
      ambientTemperature: 5,
      compressorFrequency: 75,
      isDefrosting: false
    },
    expectedCOP: { min: 2.5, max: 4.5 }
  }
};

// Outlier test cases
const outlierTestCases = {
  extremely_high_cop: {
    name: "Extremely High COP (Sensor Error)",
    data: {
      electricalPower: 500,           // Very low power (unrealistic)
      waterFlowRate: 30,
      inletTemperature: 20,
      outletTemperature: 60,          // Huge temperature rise
      ambientTemperature: 15
    }
  },

  extremely_low_cop: {
    name: "Extremely Low COP (System Issue)",
    data: {
      electricalPower: 5000,          // Very high power
      waterFlowRate: 10,              // Low flow
      inletTemperature: 40,
      outletTemperature: 42,          // Minimal temperature rise
      ambientTemperature: -20         // Very cold
    }
  },

  zero_flow: {
    name: "Zero Water Flow (Pump Failure)",
    data: {
      electricalPower: 2000,
      waterFlowRate: 0,               // No flow
      inletTemperature: 35,
      outletTemperature: 35,          // No temperature change
      ambientTemperature: 10
    }
  }
};

function formatCOPResult(result, testName) {
  const confidence = {
    high: "🟢 High",
    medium: "🟡 Medium", 
    low: "🔴 Low"
  };

  const methodDescriptions = {
    direct_thermal: "Direct Thermal (±5%)",
    carnot_estimation: "Carnot Estimation (±15%)",
    temperature_difference: "Temperature Difference (±30%)",
    insufficient_data: "❌ Insufficient Data"
  };

  let output = `\n📊 ${testName}\n`;
  output += `${'='.repeat(50)}\n`;
  output += `🎯 COP Result: ${result.cop.toFixed(3)}\n`;
  output += `📐 Method: ${methodDescriptions[result.method]}\n`;
  output += `✅ Confidence: ${confidence[result.confidence]}\n`;
  
  if (result.isOutlier) {
    output += `⚠️  OUTLIER DETECTED: ${result.outlierReason}\n`;
  }

  // Data sources
  output += `\n📊 Data Sources:\n`;
  Object.entries(result.dataSources).forEach(([key, value]) => {
    output += `  • ${key}: ${value.value} (${value.source})\n`;
  });

  // Calculation details
  if (result.calculationDetails) {
    output += `\n🔬 Calculation Details:\n`;
    Object.entries(result.calculationDetails).forEach(([key, value]) => {
      if (typeof value === 'number') {
        output += `  • ${key}: ${value.toFixed(3)}\n`;
      } else {
        output += `  • ${key}: ${value}\n`;
      }
    });
  }

  return output;
}

function testAllMethods(testData, testName) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`${'='.repeat(60)}`);

  const methods = ['auto', 'direct_thermal', 'carnot_estimation', 'temperature_difference'];
  
  methods.forEach(method => {
    try {
      const config = {
        forceMethod: method,
        enableOutlierDetection: true,
        customOutlierThresholds: {
          minCOP: 0.5,
          maxCOP: 8.0
        }
      };

      const result = COPCalculator.calculateCOP(testData, config);
      
      if (method === 'auto') {
        console.log(formatCOPResult(result, `AUTO SELECTION`));
      } else {
        const methodName = method.replace(/_/g, ' ').toUpperCase();
        console.log(`\n🔧 ${methodName}: COP = ${result.cop.toFixed(3)} (${result.confidence} confidence)`);
        
        if (result.method === 'insufficient_data') {
          console.log(`   ❌ Cannot use this method - insufficient data`);
        } else if (result.isOutlier) {
          console.log(`   ⚠️  OUTLIER: ${result.outlierReason}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });
}

function runOutlierTests() {
  console.log(`\n🚨 OUTLIER DETECTION TESTS`);
  console.log(`${'='.repeat(60)}`);

  Object.entries(outlierTestCases).forEach(([key, testCase]) => {
    const result = COPCalculator.calculateCOP(testCase.data, {
      enableOutlierDetection: true
    });

    console.log(`\n🧨 ${testCase.name}:`);
    console.log(`   COP: ${result.cop.toFixed(3)} | Method: ${result.method}`);
    
    if (result.isOutlier) {
      console.log(`   ⚠️  OUTLIER DETECTED: ${result.outlierReason}`);
    } else {
      console.log(`   ✅ No outlier detected`);
    }
  });
}

function generateDataSourceReport(data) {
  console.log(`\n📋 DATA SOURCE ANALYSIS`);
  console.log(`${'='.repeat(50)}`);

  const requiredForMethods = {
    'Direct Thermal': ['electricalPower', 'waterFlowRate', 'inletTemperature', 'outletTemperature'],
    'Carnot Estimation': ['outletTemperature', 'ambientTemperature', 'compressorFrequency'],
    'Temperature Difference': ['inletTemperature', 'outletTemperature']
  };

  Object.entries(requiredForMethods).forEach(([method, required]) => {
    const available = required.filter(field => data[field] !== undefined && data[field] !== null);
    const missing = required.filter(field => data[field] === undefined || data[field] === null);
    
    console.log(`\n🔍 ${method}:`);
    console.log(`   ✅ Available: ${available.length}/${required.length} fields`);
    
    if (available.length > 0) {
      available.forEach(field => {
        console.log(`      • ${field}: ${data[field]}`);
      });
    }
    
    if (missing.length > 0) {
      console.log(`   ❌ Missing:`);
      missing.forEach(field => {
        console.log(`      • ${field}`);
      });
    }
  });
}

function simulateRealTimeData() {
  console.log(`\n⏰ REAL-TIME SIMULATION`);
  console.log(`${'='.repeat(50)}`);

  // Simulate changing conditions over time
  const scenarios = [
    { time: "09:00", temp: 5, power: 2200, desc: "Morning startup" },
    { time: "12:00", temp: 12, power: 1800, desc: "Midday efficiency" },
    { time: "18:00", temp: 8, power: 2400, desc: "Evening demand" },
    { time: "22:00", temp: 2, power: 2800, desc: "Night operation" },
    { time: "03:00", temp: -3, power: 3200, desc: "Coldest point" }
  ];

  scenarios.forEach(scenario => {
    const testData = {
      electricalPower: scenario.power,
      waterFlowRate: 25,
      inletTemperature: 30,
      outletTemperature: 40,
      ambientTemperature: scenario.temp,
      compressorFrequency: Math.min(90, Math.max(50, 60 + (10 - scenario.temp) * 2)),
      isDefrosting: scenario.temp < 0 && Math.random() < 0.3
    };

    const result = COPCalculator.calculateCOP(testData);
    
    console.log(`\n🕒 ${scenario.time} - ${scenario.desc}`);
    console.log(`   🌡️  Ambient: ${scenario.temp}°C | ⚡ Power: ${scenario.power}W`);
    console.log(`   📊 COP: ${result.cop.toFixed(2)} (${result.method})`);
    
    if (testData.isDefrosting) {
      console.log(`   ❄️  Defrost mode active`);
    }
  });
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const simulate = args.includes('--simulate');
  const methodFilter = args.find(arg => arg.startsWith('--method='))?.split('=')[1];

  console.log(`🔧 COP CALCULATION DEBUG TOOL`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log(`🏠 Adlar Heat Pump COP Analysis\n`);

  // Run standard test cases
  Object.entries(testDataSets).forEach(([key, testSet]) => {
    if (!methodFilter || key.includes(methodFilter)) {
      testAllMethods(testSet.data, testSet.name);
      
      if (verbose) {
        generateDataSourceReport(testSet.data);
      }
      
      console.log(`\n${'─'.repeat(40)}`);
    }
  });

  // Run outlier detection tests
  runOutlierTests();

  // Run real-time simulation
  if (simulate) {
    simulateRealTimeData();
  }

  // Method descriptions
  console.log(`\n📖 METHOD DESCRIPTIONS`);
  console.log(`${'='.repeat(50)}`);
  ['direct_thermal', 'carnot_estimation', 'temperature_difference', 'insufficient_data'].forEach(method => {
    console.log(`• ${COPCalculator.getMethodDescription(method)}`);
  });

  console.log(`\n✅ Debug analysis complete!\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  testDataSets,
  outlierTestCases,
  testAllMethods,
  runOutlierTests,
  formatCOPResult
};