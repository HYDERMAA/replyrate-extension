// Test runner: classic-script, no dependencies. describe / it / expect /
// spy / beforeEach / afterEach. Failures collect into a report rendered to
// #report; summary into #summary.

const __suites = [];
let __currentSuite = null;

function describe(name, fn) {
  const suite = { name, tests: [], beforeEach: null, afterEach: null };
  __suites.push(suite);
  __currentSuite = suite;
  try { fn(); }
  finally { __currentSuite = null; }
}

function it(name, fn) {
  if (!__currentSuite) throw new Error('it() called outside describe()');
  __currentSuite.tests.push({ name, fn });
}

function beforeEach(fn) {
  if (!__currentSuite) throw new Error('beforeEach() called outside describe()');
  __currentSuite.beforeEach = fn;
}
function afterEach(fn) {
  if (!__currentSuite) throw new Error('afterEach() called outside describe()');
  __currentSuite.afterEach = fn;
}

function tick(ms) { return new Promise((r) => setTimeout(r, ms || 0)); }

function spy(returnValue) {
  const calls = [];
  const fn = function (...args) {
    calls.push(args);
    return typeof returnValue === 'function' ? returnValue.apply(this, args) : returnValue;
  };
  fn.calls = calls;
  return fn;
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => deepEqual(a[k], b[k]));
}

function stringify(v) {
  try { return JSON.stringify(v, null, 2); }
  catch (e) { return String(v); }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        throw new Error('expected ' + stringify(actual) + ' to be ' + stringify(expected));
      }
    },
    toEqual(expected) {
      if (!deepEqual(actual, expected)) {
        throw new Error('expected ' + stringify(actual) + ' to deep-equal ' + stringify(expected));
      }
    },
    toBeNull() {
      if (actual !== null) throw new Error('expected ' + stringify(actual) + ' to be null');
    },
    toBeTruthy() {
      if (!actual) throw new Error('expected ' + stringify(actual) + ' to be truthy');
    },
    toBeFalsy() {
      if (actual) throw new Error('expected ' + stringify(actual) + ' to be falsy');
    },
    toContain(item) {
      if (typeof actual === 'string') {
        if (!actual.includes(item)) throw new Error('expected ' + stringify(actual) + ' to contain ' + stringify(item));
      } else if (Array.isArray(actual)) {
        if (!actual.some((x) => deepEqual(x, item))) {
          throw new Error('expected ' + stringify(actual) + ' to contain ' + stringify(item));
        }
      } else throw new Error('toContain only supports string and array');
    },
    toMatch(re) {
      if (!re.test(actual)) throw new Error('expected ' + stringify(actual) + ' to match ' + re);
    },
    toThrow(expectedMessage) {
      let threw = false; let err;
      try { actual(); } catch (e) { threw = true; err = e; }
      if (!threw) throw new Error('expected function to throw');
      if (expectedMessage && !String(err.message).includes(expectedMessage)) {
        throw new Error('expected throw message to contain ' + stringify(expectedMessage) + ', got ' + stringify(err.message));
      }
    },
    toHaveBeenCalledWith(...expectedArgs) {
      if (!actual || !actual.calls) throw new Error('not a spy');
      const matched = actual.calls.some((c) => deepEqual(c, expectedArgs));
      if (!matched) {
        throw new Error('spy not called with ' + stringify(expectedArgs) + '; calls: ' + stringify(actual.calls));
      }
    },
    toHaveBeenCalledTimes(n) {
      if (!actual || !actual.calls) throw new Error('not a spy');
      if (actual.calls.length !== n) {
        throw new Error('expected ' + n + ' calls, got ' + actual.calls.length + ': ' + stringify(actual.calls));
      }
    },
  };
}

async function runAll() {
  const reportEl = document.getElementById('report');
  const summaryEl = document.getElementById('summary');
  let pass = 0, fail = 0;

  for (const suite of __suites) {
    const suiteEl = document.createElement('div');
    suiteEl.className = 'suite';
    const head = document.createElement('div');
    head.className = 'suite-name';
    head.textContent = suite.name;
    suiteEl.appendChild(head);
    reportEl.appendChild(suiteEl);

    for (const test of suite.tests) {
      const line = document.createElement('div');
      line.className = 'test';
      try {
        if (suite.beforeEach) await suite.beforeEach();
        await test.fn();
        if (suite.afterEach) await suite.afterEach();
        line.classList.add('pass');
        line.textContent = '✓ ' + test.name;
        pass++;
      } catch (err) {
        // afterEach should still run on a failing test so subsequent tests
        // start clean. Failures inside afterEach are reported separately.
        try { if (suite.afterEach) await suite.afterEach(); }
        catch (cleanupErr) { console.error('[runner] afterEach threw after a failed test', cleanupErr); }
        line.classList.add('fail');
        line.textContent = '✗ ' + test.name;
        const pre = document.createElement('pre');
        pre.textContent = (err && err.stack) || String(err);
        line.appendChild(pre);
        fail++;
      }
      suiteEl.appendChild(line);
    }
  }

  summaryEl.textContent = pass + ' passed, ' + fail + ' failed (' + (pass + fail) + ' total)';
  summaryEl.className = 'summary ' + (fail === 0 ? 'pass' : 'fail');
  // Future headless integration can read document.title.
  document.title = (fail === 0 ? '[ok] ' : '[fail] ') + pass + '/' + (pass + fail) + ' ReplyRate tests';
}
