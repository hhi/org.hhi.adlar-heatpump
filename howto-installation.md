# Installation Guide for Adlar Heat Pump App - for local execution

## Prerequisites

Before installing the app, ensure you have the following:

### Software Requirements

- **Node.js** (version 16 or higher) - Download from [nodejs.org](https://nodejs.org/)
- **Homey CLI** - Install with: `npm install -g homey`
- **File extraction software** (built-in on most systems)

### Account & Device Requirements

- **Homey Pro device** connected to your network
- **Athom account** (same account used for your Homey)
- **Network connectivity** between your computer and Homey device

### Heat Pump Credentials (Required for Device Pairing)

You'll need these credentials from your heat pump setup:

- **Device ID** - Found in Tuya/Smart Life app device settings
- **Local Key** - See `docs/Get Local Keys - instruction.pdf` for detailed instructions
- **IP Address** - Look for "Nest Labs - WP" or similar in your router app

## Installation Steps

### 1. Install and Setup Homey CLI

1. **Install Node.js** from [nodejs.org](https://nodejs.org/) if not already installed
   - **For Mac users**: You can also install via Homebrew: `brew install node`

2. **Install Homey CLI**:

   ```bash
   npm install -g homey
   ```

3. **Verify installation**:

   ```bash
   homey --version
   ```

4. **Login to your Homey account**:

   ```bash
   homey login
   ```

### 2. Download and Extract the App

1. **Download the App**
   - Go to the [GitHub Releases page](https://github.com/hhi/org.hhi.adlar-heatpump/releases)
   - Download the **ZIP file** from the latest release

2. **Extract the ZIP file**
   - Extract to an easily accessible location (e.g., Desktop or Downloads folder)
   - Remember the extraction path for the next steps

### 3. Install the App

1. **Open terminal/command prompt**
2. **Navigate to the extracted folder**:

   ```bash
   cd path/to/extracted/folder
   ```

3. **Install dependencies** (from package.json):

   ```bash
   npm install
   ```

4. **Install the app on your Homey**:

   ```bash
   homey app install
   ```

5. **Select your Homey device** if prompted
6. **Wait for installation to complete**

## Device Pairing and Management

### Add Your Heat Pump

1. **Open the Homey app** on your phone
2. **Go to**: "Devices" → "Add Device"
3. **Search for**: "Adlar Heat Pump"
4. **Follow the pairing wizard** and enter:
   - Device ID (from Tuya/Smart Life app)
   - Local Key (see `docs/Get Local Keys - instruction.pdf`)
   - IP Address (look for "Nest Labs -WP" in router)

### Using Homey Developer Tools (After Installation)

Once the app is installed and your device is paired, you can monitor live values:

1. **Visit**: [https://tools.developer.homey.app/tools/devices](https://tools.developer.homey.app/tools/devices)
2. **Enter search term**: `adlar`
3. **View real-time device data** and capabilities

### Important Notes

- **Heating Curve Picklist**: The heating curve selection has been disabled due to a bug observed on iPhone devices. To change heating curve values, use the dedicated action flow card instead.
- **Flow Cards**: Most device settings can be controlled through Homey's flow cards for automation purposes.

### Obtaining Required Credentials

#### Device ID

- Open **Tuya/Smart Life app**
- Navigate to your heat pump device
- Go to device settings → Device Information
- Copy the Device ID

#### Local Key

- **Detailed Instructions**: See `docs/Get Local Keys - instruction.pdf` for complete step-by-step guide
- Register at [Tuya Developer Portal](https://iot.tuya.com/)
- Create a project and link your device
- Extract the Local Key from device details

#### IP Address

- Check your **router's admin panel** for connected devices
- Look specifically for **"Nest Labs -WP"** or similar device name
- Use a **network scanner app** to find Tuya devices if needed
- Look for devices with "Tuya" or your heat pump's MAC address

## Troubleshooting

### Installation Issues

- **CLI not found**: Ensure Node.js and Homey CLI are properly installed
- **Authentication failed**: Run `homey login` again and verify credentials
- **Installation timeout**: Check network connectivity to Homey device
- **Permission errors**: Run terminal as administrator (Windows) or use `sudo` (macOS/Linux)

### Device Pairing Issues

- **Device not found**: Verify IP address and network connectivity
- **Authentication failed**: Double-check Device ID and Local Key
- **Connection timeout**: Ensure heat pump and Homey are on same network
- **Invalid credentials**: Re-obtain credentials from Tuya platform

### General Issues

- **App not appearing**: Restart Homey app and check installed apps list
- **Updates needed**: Repeat installation process with newer releases
- **Network problems**: Ensure stable connection between all devices

## Verification

After successful installation:

1. **Check Homey app** - The Adlar Heat Pump app should appear in your apps list
2. **Verify device connection** - Heat pump should show online status
3. **Test basic functions** - Try reading temperature values or changing settings

## Support

For additional help:

- **GitHub Issues**: [Report problems here](https://github.com/hhi/org.hhi.adlar-heatpump/issues)
- **Homey Community**: Search for existing solutions or ask questions
- **Documentation**: Review the app's README and documentation files
