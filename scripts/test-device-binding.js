const test = require('node:test');
const assert = require('node:assert');

const {
  enforceDeviceBinding,
} = require('../src/services/deviceBindingService');

// Minimal fake of a Mongoose user document for the parts the service touches.
const makeEmployee = (boundDevice = undefined) => ({
  _id: 'EMP0000001',
  name: 'Test Employee',
  accountRole: 'employee',
  boundDevice,
  saveCalls: 0,
  async save() {
    this.saveCalls += 1;
  },
});

test('first check-in binds the current device', async () => {
  const employee = makeEmployee();

  const result = await enforceDeviceBinding(employee, {
    deviceId: 'device-a',
    deviceName: 'Samsung S21',
    platform: 'android',
  });

  assert.strictEqual(result.justRegistered, true);
  assert.strictEqual(employee.boundDevice.deviceId, 'device-a');
  assert.strictEqual(employee.boundDevice.deviceName, 'Samsung S21');
  assert.strictEqual(employee.boundDevice.platform, 'android');
  assert.ok(employee.boundDevice.boundAt instanceof Date);
  assert.strictEqual(employee.saveCalls, 1);
});

test('same device passes without re-binding', async () => {
  const employee = makeEmployee({
    deviceId: 'device-a',
    deviceName: 'Samsung S21',
    platform: 'android',
    boundAt: new Date(),
  });

  const result = await enforceDeviceBinding(employee, {
    deviceId: 'device-a',
    deviceName: 'Samsung S21',
    platform: 'android',
  });

  assert.strictEqual(result.justRegistered, false);
  assert.strictEqual(employee.saveCalls, 0);
});

test('different device is rejected with 403', async () => {
  const employee = makeEmployee({
    deviceId: 'device-a',
    deviceName: 'Samsung S21',
    platform: 'android',
    boundAt: new Date(),
  });

  await assert.rejects(
    () =>
      enforceDeviceBinding(employee, {
        deviceId: 'device-B',
        deviceName: 'iPhone 14',
        platform: 'ios',
      }),
    (err) => {
      assert.strictEqual(err.statusCode, 403);
      assert.match(err.message, /not registered for your account/i);
      return true;
    }
  );
  assert.strictEqual(employee.saveCalls, 0);
});

test('missing deviceId is rejected with 400', async () => {
  const employee = makeEmployee();

  await assert.rejects(
    () => enforceDeviceBinding(employee, { deviceId: '' }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /device verification failed/i);
      return true;
    }
  );
});

test('device ids are compared case-insensitively', async () => {
  const employee = makeEmployee({
    deviceId: 'ios_D622A190-3886-49F7-8B8A-6279D0FD0DC5',
    deviceName: 'iPhone',
    platform: 'ios',
    boundAt: new Date(),
  });

  const result = await enforceDeviceBinding(employee, {
    deviceId: 'ios_d622a190-3886-49f7-8b8a-6279d0fd0dc5',
    deviceName: 'iPhone',
    platform: 'ios',
  });

  assert.strictEqual(result.justRegistered, false);
  assert.strictEqual(employee.boundDevice.deviceId, 'ios_d622a190-3886-49f7-8b8a-6279d0fd0dc5');
  assert.strictEqual(employee.saveCalls, 1);
});

test('same device refreshes changed metadata', async () => {
  const employee = makeEmployee({
    deviceId: 'device-a',
    deviceName: 'Old Name',
    platform: 'android',
    boundAt: new Date(),
  });

  await enforceDeviceBinding(employee, {
    deviceId: 'device-a',
    deviceName: 'New Name',
    platform: 'android',
  });

  assert.strictEqual(employee.boundDevice.deviceName, 'New Name');
  assert.strictEqual(employee.saveCalls, 1);
});
