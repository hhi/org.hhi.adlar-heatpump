import { App } from 'homey';
import enableDebugInspector from './app-debug';

class MyApp extends App {
  async onInit() {

    if (process.env.DEBUG === '1') {
      this.log('Development mode detected, enabling debug features');
      await enableDebugInspector();
    }

    this.log('MyApp has been initialized');
  }
}

// Export the app class exactly this way, so it can be used by Homey
// This is necessary for Homey to recognize and run the app, when it starts up.
module.exports = MyApp;
