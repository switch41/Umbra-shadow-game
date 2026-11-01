let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL  ${msg}`);
  }
}

function withStore(fn) {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
  };
  try {
    return fn(map);
  } finally {
    delete globalThis.window;
  }
}

const mod = await import('../src/store.js');
const { loadBest, saveBest } = mod;

withStore(() => {
  assert(loadBest(1) === null, 'empty store returns null');
  assert(saveBest(1, 12.5, 3) === true, 'first save returns true');
  assert(loadBest(1).time === 12.5 && loadBest(1).turns === 3, 'roundtrip');
  assert(saveBest(1, 13.0, 2) === false, 'slower time rejected');
  assert(loadBest(1).time === 12.5, 'slower time not stored');
  assert(saveBest(1, 12.5, 2) === true, 'same time fewer turns accepted');
  assert(loadBest(1).turns === 2, 'turn tiebreak stored');
  assert(saveBest(1, 12.5, 3) === false, 'same time more turns rejected');
  assert(saveBest(1, 11.9, 9) === true, 'faster time accepted despite turns');
  assert(loadBest(1).time === 11.9 && loadBest(1).turns === 9, 'faster time stored');
  assert(saveBest(2, 5, 1) === true, 'levels independent');
  assert(loadBest(2).time === 5, 'level 2 intact after level 1 saves');
  assert(loadBest(1).time === 11.9, 'level 1 intact after level 2 save');
});

withStore((map) => {
  map.set('umbra.best.v1', '{bad json');
  assert(loadBest(1) === null, 'corrupt JSON treated as empty');
  assert(saveBest(1, 10, 1) === true, 'save works after corrupt read');
  assert(loadBest(1).time === 10, 'save recovered from corrupt read');
});

withStore(() => {
  globalThis.window = {
    get localStorage() {
      throw new Error('denied');
    },
  };
  assert(loadBest(1) === null, 'storage throw → null');
  assert(saveBest(1, 10, 1) === true, 'storage throw → still reports better');
});

if (fail) {
  console.error(`\nstore checks: ${pass} passed, ${fail} FAILED`);
  process.exit(1);
}
console.log(`OK   store checks ${pass}/${pass}`);
