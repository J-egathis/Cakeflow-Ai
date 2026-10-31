// Lightweight in-memory response cache for heavy read endpoints (orders list, analytics, accounts).
// - Every DB write (create / save / update / destroy on any model) bumps a global data version via
//   Sequelize hooks (see config/mysql.js), which instantly invalidates all cached responses.
// - Identical requests arriving at the same time share ONE database query (in-flight coalescing),
//   so many screens polling together (Admin, Chef, Reception, Tables) never stampede MySQL.

let dataVersion = 1;
const store = new Map(); // key -> { version, expiresAt, body }
const inFlight = new Map(); // key@version -> Promise<string>
const MAX_ENTRIES = 200;

const bumpDataVersion = () => {
  dataVersion += 1;
};

const getDataVersion = () => dataVersion;

const getCachedJson = async (key, ttlMs, computeFn) => {
  const now = Date.now();
  const version = dataVersion;
  const hit = store.get(key);
  if (hit && hit.version === version && hit.expiresAt > now) {
    return hit.body;
  }

  const flightKey = `${key}@${version}`;
  if (inFlight.has(flightKey)) {
    return inFlight.get(flightKey);
  }

  const promise = (async () => {
    try {
      const result = await computeFn();
      const body = JSON.stringify(result);
      // Only store if no write happened while we were computing (otherwise data may be stale)
      if (version === dataVersion) {
        if (store.size >= MAX_ENTRIES) {
          const firstKey = store.keys().next().value;
          store.delete(firstKey);
        }
        store.set(key, { version, expiresAt: Date.now() + ttlMs, body });
      }
      return body;
    } finally {
      inFlight.delete(flightKey);
    }
  })();

  inFlight.set(flightKey, promise);
  return promise;
};

// Send a pre-serialized JSON string. Express auto-generates an ETag and replies 304 Not Modified
// when the browser already has the same data, so unchanged polls transfer almost nothing.
const sendJsonString = (res, body) => {
  res.set('Cache-Control', 'private, no-cache');
  res.type('application/json').send(body);
};

module.exports = {
  bumpDataVersion,
  getDataVersion,
  getCachedJson,
  sendJsonString
};
