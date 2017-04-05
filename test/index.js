'use strict';

const test = require('tape');
const spdx = require('spdx');
const pkg = require('../package.json');
const proxyquire = require('proxyquire');

test('npm init', (t) => {
  t.ok(pkg.name, 'Run npm init');
  return t.end();
});

test('license', (t) => {
  t.ok(pkg.license, 'must license package');
  if (!pkg.license) {
    return t.end();
  }

  // We don't use a clause, pick one or the other
  const license = spdx.parse(pkg.license).license;

  // Either enforce freedom or fully commit to the public good
  t.ok(
    license === 'AGPL-3.0' ||
    license === 'Unlicense',
    'Using either the AGPL or Unlicense');

  return t.end();
});

test('Handles retry logic', (t) => {
  let done = false;
  const called = [0, 0, 0];
  const errors = [new Error('foo'), new Error('bar')];
  const callbacks = [
    // First request fails once
    () => {
      t.notok(done, 'never call after complete');
      called[0] += 1;
      t.ok(called[0] <= 2, 'only retry 2');
      return called[0] - 1 === 0 ? errors[0] : null;
    },
    // Second request always fails
    () => {
      t.notok(done, 'never call after complete');
      called[1] += 1;
      t.ok(called[1] <= 2, 'only retry 2');
      return errors[1];
    },
    // Third request never fails
    () => {
      // Expect either the first or second request to have fully completed
      // before this executes
      t.ok(called[0] === 2 || called[1] === 2, 'Concurrency of 2');
      t.notok(done, 'never call after complete');
      called[2] += 1;
      t.ok(called[2] <= 1, 'No retry on success');
      return null;
    },
  ];

  const Pool = proxyquire('../index.js', {
    request: function request(opts, cb) {
      return setImmediate(cb, callbacks[opts.i]());
    },
  });
  const request = new Pool({
    jitter: 0,
    size: 2,
    tries: 2,
  });

  function isDone() {
    const count = called.reduce((p, v) => p + v, 0);
    if (count > 5) {
      t.fail('Called functions too many times');
    } else if (count === 5 && done === false) {
      done = true;
      t.end();
    }
  }
  request({ i: 0 }, isDone);
  request({ i: 1 }, isDone);
  request({ i: 2 }, isDone);
});
