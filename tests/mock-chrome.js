// Minimal chrome.* mock for the test harness. Tests that need different
// behavior call __setNextSetShouldReject, __setActiveTab, etc. before the
// code-under-test executes. Storage onChanged fires synchronously inside
// set/remove/clear for test determinism. Real Chrome fires asynchronously;
// tests that care about that timing stay in the manual verification list.

(function () {
  let _store = {};
  let _listeners = [];
  let _setShouldReject = false;
  let _activeTab = { id: 1, url: 'https://example.com/', title: 'example' };
  const _sentMessages = [];
  const _createdTabs = [];
  const _openedPanels = [];

  function fire(changes) {
    if (!Object.keys(changes).length) return;
    // Slice so a listener that calls removeListener during the dispatch
    // does not corrupt the in-flight iteration.
    _listeners.slice().forEach((fn) => {
      try { fn(changes, 'local'); }
      catch (e) { console.error('[mock] storage listener threw', e); }
    });
  }

  const storage = {
    local: {
      get(keys) {
        if (keys == null) return Promise.resolve({ ..._store });
        if (typeof keys === 'string') {
          return Promise.resolve(keys in _store ? { [keys]: _store[keys] } : {});
        }
        if (Array.isArray(keys)) {
          const out = {};
          for (const k of keys) if (k in _store) out[k] = _store[k];
          return Promise.resolve(out);
        }
        // object form: { key: defaultValue }
        const out = {};
        for (const [k, def] of Object.entries(keys)) {
          out[k] = k in _store ? _store[k] : def;
        }
        return Promise.resolve(out);
      },
      set(items) {
        if (_setShouldReject) {
          _setShouldReject = false;
          return Promise.reject(new Error('mock storage rejected'));
        }
        const changes = {};
        for (const [k, v] of Object.entries(items)) {
          const oldValue = _store[k];
          changes[k] = { oldValue, newValue: v };
          _store[k] = v;
        }
        fire(changes);
        return Promise.resolve();
      },
      remove(keys) {
        const arr = Array.isArray(keys) ? keys : [keys];
        const changes = {};
        for (const k of arr) {
          if (k in _store) {
            changes[k] = { oldValue: _store[k] };
            delete _store[k];
          }
        }
        fire(changes);
        return Promise.resolve();
      },
      clear() {
        const changes = {};
        for (const k of Object.keys(_store)) {
          changes[k] = { oldValue: _store[k] };
        }
        _store = {};
        fire(changes);
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener(fn) { _listeners.push(fn); },
      removeListener(fn) {
        const i = _listeners.indexOf(fn);
        if (i >= 0) _listeners.splice(i, 1);
      },
    },
  };

  const tabs = {
    create(opts) {
      _createdTabs.push(opts);
      return Promise.resolve({ id: _createdTabs.length + 1000, ...opts });
    },
    query(_q) {
      return Promise.resolve([_activeTab]);
    },
    get(id) {
      if (_activeTab && _activeTab.id === id) return Promise.resolve(_activeTab);
      return Promise.reject(new Error('No such tab: ' + id));
    },
    update() { return Promise.resolve(); },
  };

  const runtime = {
    // Settable so tests can simulate the chrome.runtime.lastError pattern
    // for the onChanged path inside Tracker.
    lastError: null,
    sendMessage(msg) {
      _sentMessages.push(msg);
      return Promise.resolve({ accepted: true });
    },
    onMessage: {
      addListener() {},
      removeListener() {},
    },
  };

  const sidePanel = {
    setPanelBehavior() { return Promise.resolve(); },
    open(opts) {
      _openedPanels.push(opts);
      return Promise.resolve();
    },
  };

  const scripting = { registerContentScripts() { return Promise.resolve(); } };
  const windows = { update() { return Promise.resolve(); } };

  // Test-only helpers, prefixed with __ so production code cannot accidentally
  // depend on them.
  const helpers = {
    __reset() {
      _store = {};
      _listeners = [];
      _setShouldReject = false;
      _sentMessages.length = 0;
      _createdTabs.length = 0;
      _openedPanels.length = 0;
      _activeTab = { id: 1, url: 'https://example.com/', title: 'example' };
      runtime.lastError = null;
    },
    __setStore(obj) { _store = { ...obj }; },
    __getStore() { return { ..._store }; },
    __setNextSetShouldReject() { _setShouldReject = true; },
    __setActiveTab(tab) { _activeTab = tab; },
    __sentMessages: () => _sentMessages.slice(),
    __createdTabs:  () => _createdTabs.slice(),
    __openedPanels: () => _openedPanels.slice(),
    __listenerCount: () => _listeners.length,
  };

  window.chrome = { storage, tabs, runtime, sidePanel, scripting, windows };
  window.__mockChrome = helpers;
})();
