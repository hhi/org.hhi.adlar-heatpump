import { App } from 'homey';

class MyApp extends App {
  async onInit() {
    this.log('MyApp has been initialized');
  }
}

// Export the app class exactly this way, so it can be used by Homey
// This is necessary for Homey to recognize and run the app, when it starts up.
module.exports = MyApp;
