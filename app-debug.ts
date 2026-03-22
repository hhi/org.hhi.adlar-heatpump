/* eslint-disable global-require */
/* eslint-disable node/no-unsupported-features/node-builtins */
// This file is used to enable the Node.js inspector for debugging purposes.
// It is only imported when the DEBUG environment variable is set to '1'.
// This allows you to debug your Homey app using Chrome DevTools or any other Node.js
// compatible debugger.
// One use usage is to  do following steps:
// 1. Set the DEBUG environment variable to '1' before starting your Homey app
// 2. Start your Homey app with `homey app run`
// 3. attach to the debugger by run and debug the "Attach to Docker Node App" configuration in VSCode, after setting breakpoints in the TS sources.
// as an alternative step 3, use the chrome inpector by `chrome://inspect`, here you can debug the javascripts.

export default async function enableDebugInspector() {
  if (
    typeof process !== 'undefined'
    && process.env.DEBUG === '1'
    && process.versions
    && process.versions.node
  ) {
    try {
      const inspector = require('inspector') as typeof import('inspector');
      process.stderr.write('WaitForDebugger inspector for debugging\n');
      inspector.waitForDebugger();
    } catch (error) {
      const inspector = require('inspector') as typeof import('inspector');
      process.stderr.write('Open inspector for debugging\n');
      inspector.open(9225, '0.0.0.0', true);
    }
  }
}
