const test = require('node:test');
const assert = require('node:assert');

const {
  enforceDeviceBinding,
  registerDeviceBinding,
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
    deviceId: 'device-A',
    deviceName: 'Samsung S21',
    platform: 'android',
  });

  assert.strictEqual(result.justRegistered, true);
  assert.strictEqual(employee.boundDevice.deviceId, 'device-A');
  assert.strictEqual(employee.boundDevice.deviceName, 'Samsung S21');
  assert.strictEqual(employee.boundDevice.platform, 'android');
  assert.ok(employee.boundDevice.boundAt instanceof Date);
  assert.strictEqual(employee.saveCalls, 1);
});

test('same device passes without re-binding', async () => {
  const employee = makeEmployee({
    deviceId: 'device-A',
    deviceName: 'Samsung S21',
    platform: 'android',
    boundAt: new Date(),
  });

  const result = await enforceDeviceBinding(employee, {
    deviceId: 'device-A',
    deviceName: 'Samsung S21',
    platform: 'android',
  });

  assert.strictEqual(result.justRegistered, false);
  assert.strictEqual(employee.saveCalls, 0);
});

test('different device is rejected with 403', async () => {
  const employee = makeEmployee({
    deviceId: 'device-A',
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

test('same device refreshes changed metadata', async () => {
  const employee = makeEmployee({
    deviceId: 'device-A',
    deviceName: 'Old Name',
    platform: 'android',
    boundAt: new Date(),
  });

  await enforceDeviceBinding(employee, {
    deviceId: 'device-A',
    deviceName: 'New Name',
    platform: 'android',
  });

  assert.strictEqual(employee.boundDevice.deviceName, 'New Name');
  assert.strictEqual(employee.saveCalls, 1);
});

test('login registration binds when unbound', async () => {
  const employee = makeEmployee();

  const result = await registerDeviceBinding(employee, {
    deviceId: 'device-A',
    deviceName: 'Samsung S21',
    platform: 'android',
  });

  assert.strictEqual(result.justRegistered, true);
  assert.strictEqual(result.mismatch, false);
  assert.strictEqual(employee.boundDevice.deviceId, 'device-A');
});

test('login registration reports mismatch without throwing', async () => {
  const employee = makeEmployee({
    deviceId: 'device-A',
    deviceName: 'Samsung S21',
    platform: 'android',
    boundAt: new Date(),
  });

  const result = await registerDeviceBinding(employee, {
    deviceId: 'device-B',
    deviceName: 'iPhone 14',
    platform: 'ios',
  });

  assert.strictEqual(result.mismatch, true);
  assert.strictEqual(result.bound, false);
  assert.strictEqual(employee.saveCalls, 0);
});
