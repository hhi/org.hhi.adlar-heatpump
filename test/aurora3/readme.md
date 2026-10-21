# Modbus setup

For testing on macOS, I recommend using the **Modbus Server Pro** app, available on the App Store. It is highly advisable to get this version rather than the basic edition, as it provides the advanced features needed for thorough testing.

To get started, simply load the [full-registerset](./adlar3-server.mbs) file into the Modbus Server Pro app.

Alternatively, you can use a script to [initialize](./test-sim3-registers-init.txt) the holding registers automatically via FC06. Please note that if you choose this route, the read-only input registers will still need to be set manually.

For further validation, you can examine the register states in the [sim3 dump](./test-sim3-registers-dump.txt) and the [adlar3 dump](./test-adlar3-registers-dump.txt).
