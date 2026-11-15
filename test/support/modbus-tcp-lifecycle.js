// The same node:test suite loads each compiled transport; t is a TestContext.
/* eslint-disable import/no-dynamic-require, global-require, mocha/handle-done-callback */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { Duplex } = require('node:stream');
const { setTimeout: wait } = require('node:timers/promises');

// Exercise the installed jsmodbus queue with real Duplex stream semantics.
// end() deliberately leaves the peer open, reproducing the reported FIN race.
class BridgeSocket extends Duplex {
  constructor() {
    super({ allowHalfOpen: true });
    this.requests = [];
    this.endCalls = 0;
    this.connectCalls = 0;
    this.autoReply = false;
    this.value = 42;
    this.errors = [];
    this.on('error', (err) => this.errors.push(err));
  }

  _read() {}

  _write(payload, encoding, callback) {
    this.requests.push(Buffer.from(payload));
    if (this.autoReply) queueMicrotask(() => this.reply(payload));
    callback();
  }

  // The remote does not finish the half-closed connection.
  _final() {}

  end(...args) {
    this.endCalls++;
    return super.end(...args);
  }

  connect() {
    this.connectCalls++;
    setImmediate(() => {
      if (!this.destroyed) this.emit('connect');
    });
    return this;
  }

  setKeepAlive() {
    return this;
  }

  setTimeout() {
    return this;
  }

  reply(request) {
    if (this.destroyed) return;
    const fc = request[7];
    if (fc === 3 || fc === 4) {
      const count = request.readUInt16BE(10);
      const response = Buffer.alloc(9 + count * 2);
      request.copy(response, 0, 0, 8);
      response.writeUInt16BE(3 + count * 2, 4);
      response[8] = count * 2;
      for (let i = 0; i < count; i++) response.writeUInt16BE(this.value, 9 + i * 2);
      this.push(response);
    } else if (fc === 1) {
      const response = Buffer.alloc(10);
      request.copy(response, 0, 0, 8);
      response.writeUInt16BE(4, 4);
      response[8] = 1;
      response[9] = 1;
      this.push(response);
    } else {
      this.push(Buffer.from(request));
    }
  }
}

function loadTransport(modulePath) {
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'net') return { Socket: BridgeSocket };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(modulePath).ModbusTcpService;
  } finally {
    Module._load = originalLoad;
  }
}

function timers() {
  const active = new Map();
  return {
    active,
    setTimeout(fn, ms) {
      // eslint-disable-next-line homey-app/global-timers
      const handle = setTimeout(() => {
        active.delete(handle); fn();
      }, ms);
      active.set(handle, { fn, ms });
      return handle;
    },
    clearTimeout(handle) {
      clearTimeout(handle); active.delete(handle);
    },
    // eslint-disable-next-line homey-app/global-timers
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (handle) => clearInterval(handle),
  };
}

module.exports = function lifecycleTests(modulePath) {
  const Transport = loadTransport(modulePath);
  async function createConnectedService(t, config = {}) {
    const provider = timers();
    const service = new Transport({
      host: 'bridge.invalid', timeoutMs: 25, batchDelayMs: 0, timerProvider: provider, ...config,
    });
    const errors = [];
    service.on('error', (err) => errors.push(err));
    t.after(() => service.destroy());
    await service.connect();
    return {
      service, socket: service.socket, provider, errors,
    };
  }

  for (const close of ['disconnect', 'destroy']) {
    test(`${close}: active and queued jsmodbus requests settle without writing after end`, async (t) => {
      const {
        service, socket, provider, errors,
      } = await createConnectedService(t);
      // Register rejection handlers before closing; node:test catches unhandled errors too.
      const requests = Promise.allSettled([
        service.readHoldingRegisters(0x100, 1),
        service.readHoldingRegisters(0x101, 1),
        service.writeSingleRegister(0x102, 7),
        service.writeSingleCoil(0x1000, true),
        service.readSingleCoil(0x1001),
      ]);
      await Promise.resolve(); // Admit both writes to the real jsmodbus queue.
      assert.equal(socket.requests.length, 1);
      await service[close]();
      const result = await requests;
      assert.ok(result.every((r) => r.status === 'rejected'));
      await wait(60); // Beyond request timeout: no old queue callback may write.
      assert.equal(socket.endCalls, 0);
      assert.equal(socket.requests.length, 1);
      assert.deepEqual(socket.errors, []);
      assert.deepEqual(errors, []);
      assert.equal(provider.active.size, 0);
      await assert.rejects(service.readHoldingRegisters(0, 1), /closed|destroyed/);
      await assert.rejects(service.writeSingleRegister(0, 1), /closed|destroyed/);
      await assert.rejects(service.writeSingleCoil(0, true), /closed|destroyed/);
    });
  }

  test('destroy: an in-flight poll never emits error or completion after listener cleanup', async (t) => {
    const { service, socket, errors } = await createConnectedService(t);
    const completions = [];
    service.on('poll-complete', (name) => completions.push(name));
    const poll = service._runPollGroup({ name: 'fast', blocks: [{ start: 0, count: 1 }, { start: 1, count: 1 }] });
    service.removeAllListeners(); // Models upper-layer cleanup during forceReconnect.
    await service.destroy();
    await poll;
    assert.equal(socket.requests.length, 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(completions, []);
  });

  test('manual disconnect cancels an in-progress connect and remains disconnected', async () => {
    const service = new Transport({ host: 'bridge.invalid' });
    const result = assert.rejects(service.connect(), /closed/);
    await service.disconnect();
    await result;
    assert.equal(service.connected, false);
    await service.destroy();
  });

  test('disconnect and destroy are idempotent; disconnect cannot revive a destroyed service', async (t) => {
    const { service } = await createConnectedService(t);
    await Promise.all([service.destroy(), service.disconnect(), service.destroy()]);
    await service.disconnect();
    await assert.rejects(service.connect(), /destroyed/);
  });

  test('old socket callbacks cannot affect an explicitly reopened connection', async (t) => {
    const {
      service, socket: old, provider, errors,
    } = await createConnectedService(t);
    await service.disconnect();
    await Promise.all([service.connect(), service.connect()]);
    const fresh = service.socket;
    assert.notEqual(fresh, old);
    assert.equal(fresh.connectCalls, 1);
    fresh.autoReply = true;
    old.emit('error', new Error('late close error'));
    old.emit('timeout');
    old.emit('connect');
    old.emit('close', true);
    assert.equal(service.connected, true);
    assert.deepEqual(errors, []);
    assert.equal(provider.active.size, 0);
    await service.readHoldingRegisters(0x100, 1);
    assert.equal(service.u16(0x100), 42);
  });

  test('remote close reconnects once and resumes normal polling on a new socket', async (t) => {
    const { service, socket, provider } = await createConnectedService(t);
    const groups = [{ name: 'fast', intervalMs: 1000, blocks: [{ start: 0x100, count: 1 }] }];
    service.startPolling(groups);
    socket.destroy();
    await new Promise((resolve) => socket.once('close', resolve));
    const [handle, reconnect] = [...provider.active].find(([, entry]) => entry.ms === 2000);
    provider.clearTimeout(handle);
    reconnect.fn();
    await new Promise((resolve) => service.once('connected', resolve));
    service.socket.autoReply = true;
    await new Promise((resolve) => service.once('poll-complete', resolve));
    assert.equal(service.u16(0x100), 42);
    assert.equal(service.stats.reconnects, 1);
    assert.equal(socket.requests.length, 0);
  });

  test('disconnect cancels backoff and a previously queued reconnect callback is inert', async (t) => {
    const { service, socket, provider } = await createConnectedService(t);
    socket.destroy();
    await new Promise((resolve) => socket.once('close', resolve));
    const callback = [...provider.active.values()].find((entry) => entry.ms === 2000).fn;
    await service.disconnect();
    callback();
    await Promise.resolve();
    assert.equal(service.socket, socket);
    assert.equal(service.connected, false);
    assert.equal(provider.active.size, 0);
  });

  test('closing during batch delay clears the timer and stops the old poll before its next block', async (t) => {
    const { service, socket, provider } = await createConnectedService(t, { batchDelayMs: 10000 });
    socket.autoReply = true;
    const group = { name: 'fast', blocks: [{ start: 0, count: 1 }, { start: 1, count: 1 }] };
    const poll = service._runPollGroup(group);
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok([...provider.active.values()].some((entry) => entry.ms === 10000));
    await service.disconnect();
    await poll;
    assert.equal(socket.requests.length, 1);
    assert.equal(provider.active.size, 0);
  });

  test('resolved old responses cannot update the cache after disconnect', async (t) => {
    const { service, socket } = await createConnectedService(t);
    const result = assert.rejects(service.readHoldingRegisters(0x100, 1), /closed/);
    socket.reply(socket.requests[0]); // Resolve jsmodbus, but defer the async continuation.
    await service.disconnect();
    await result;
    assert.equal(service.has(0x100), false);
  });

  test('a write waiting for admission cannot hop into an explicitly reopened session', async (t) => {
    const { service } = await createConnectedService(t);
    const result = assert.rejects(service.writeSingleRegister(0x100, 7), /closed/);
    const closing = service.disconnect();
    await Promise.all([closing, service.connect()]);
    await result;
    assert.equal(service.socket.requests.length, 0);
  });

  test('normal FC03, FC01, FC06 and FC05 remain usable', async (t) => {
    const { service, socket } = await createConnectedService(t);
    socket.autoReply = true;
    await service.readHoldingRegisters(0x100, 1);
    assert.equal(service.u16(0x100), 42);
    assert.equal(await service.readSingleCoil(0x1000), 1);
    await service.writeSingleRegister(0x101, -5);
    await service.writeSingleCoil(0x1001, true);
    assert.equal(service.s16(0x101), -5);
    assert.deepEqual(socket.requests.map((r) => r[7]), [3, 1, 6, 5]);
  });

  if (!Transport.prototype.readInputRegisters) {
    const path = require('node:path');
    const { Adlar2ModbusService } = require(path.join(path.dirname(modulePath), 'adlar2-modbus-service'));
    const { ModbusConnectionService } = require(path.join(path.dirname(modulePath), '../services/modbus-connection-service'));

    test('Aurora II initialization cannot emit connected or error after destroy', async () => {
      const service = new Adlar2ModbusService({ transport: { host: 'bridge.invalid', timeoutMs: 25 } });
      const events = [];
      service.on('connected', () => events.push('connected'));
      service.on('error', (error) => events.push(error));
      await service.connect(); // runInitValidation has a request outstanding.
      assert.equal(service.tcp.socket.requests.length, 1);
      service.removeAllListeners();
      await service.destroy();
      await wait(60);
      assert.deepEqual(events, []);
    });

    test('forceReconnect drains the old service and polling succeeds on its replacement', async (t) => {
      const provider = timers();
      const services = [];
      const errors = [];
      let connected = 0;
      const connection = new ModbusConnectionService({
        device: { homey: provider },
        createService: ({ config, timerProvider }) => {
          const service = new Adlar2ModbusService({ transport: { host: config.host, timeoutMs: 25, batchDelayMs: 0 }, timerProvider });
          if (services.length) {
            service.tcp.socket.autoReply = true;
            service.tcp.socket.value = 2; // Refrigerant R32, valid during init.
          }
          services.push(service);
          return service;
        },
        onData: () => {},
        onConnected: () => {
          connected++;
        },
        onDisconnected: () => {},
        onError: (err) => errors.push(err),
      });
      connection._initialDelayDone = true;
      t.after(() => connection.destroy());
      await connection.connect({ host: 'bridge.invalid' });
      const old = services[0];
      const pending = Promise.allSettled([old.tcp.readHoldingRegisters(0x100, 1), old.tcp.readHoldingRegisters(0x101, 1)]);
      await Promise.all([connection.forceReconnect('poll timeout'), connection.forceReconnect('duplicate')]);
      assert.equal(services.length, 2);
      assert.ok((await pending).every((r) => r.status === 'rejected'));
      const fresh = services[1];
      if (connected === 0) await new Promise((resolve) => fresh.once('connected', resolve));
      await new Promise((resolve) => fresh.tcp.once('poll-complete', resolve));
      assert.equal(connected, 1);
      assert.equal(old.tcp.socket.requests.length, 1);
      assert.deepEqual(old.tcp.socket.errors, []);
      // The mock answers every register with 2, so 0x0301 cannot confirm the temperature scale (logged only).
      assert.deepEqual(errors.filter((err) => !/temperatuurschaal/.test(err.message)), []);
      await connection.destroy();
      assert.equal(provider.active.size, 0);
    });
  }

  if (Transport.prototype.readInputRegisters) {
    test('Aurora III FC04 rejects stale responses and works after reconnect', async (t) => {
      const { service, socket } = await createConnectedService(t);
      const result = assert.rejects(service.readInputRegisters(0x3000, 1), /closed/);
      socket.reply(socket.requests[0]);
      await service.disconnect();
      await result;
      assert.equal(service.has(0x3000), false);
      await service.connect();
      service.socket.autoReply = true;
      await service.readInputRegisters(0x3000, 1);
      assert.equal(service.u16(0x3000), 42);
    });
  }
};
