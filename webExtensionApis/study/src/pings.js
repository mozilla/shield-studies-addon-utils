const { utils: Cu } = Components;
Cu.import("resource://gre/modules/TelemetryArchive.jsm");

/**
 * Returns array of pings of type `type` in reverse sorted order by timestamp
 * first element is most recent ping
 *
 * filters
 * - type:  string or array of ping types
 * - n:  positive integer. at most n pings.
 * - timestamp:  only pings after this timestamp.
 * - headersOnly: boolean, just the 'headers' for the pings, not the full bodies.
 */
export async function getTelemetryPings(filters) {
  let { type } = filters;
  const { n, timestamp, headersOnly } = filters;
  // {type, id, timestampCreated}
  let pings = await TelemetryArchive.promiseArchivedPingList();
  if (type) {
    if (!(type instanceof Array) && typeof type.length !== "number") {
      type = [type]; // Array-ify if it's a string
    }
  }

  if (type) pings = pings.filter(p => type.includes(p.type));

  if (timestamp) pings = pings.filter(p => p.timestampCreated > timestamp);

  pings.sort((a, b) => b.timestampCreated - a.timestampCreated);
  if (n) pings = pings.slice(0, n);
  const pingData = headersOnly
    ? pings
    : pings.map(ping => TelemetryArchive.promiseArchivedPingById(ping.id));

  return Promise.all(pingData);
}

export async function getShieldPingsAfterTimestamp(ts) {
  return getTelemetryPings({
    type: ["shield-study", "shield-study-addon"],
    timestamp: ts,
  });
}

export function summarizePings(pings) {
  return pings.map(p => [p.payload.type, p.payload.data]);
}

export function searchTelemetry(conditionArray, telemetryArray) {
  const resultingPings = [];
  for (const condition of conditionArray) {
    const index = telemetryArray.findIndex(ping => condition(ping));
    if (index === -1) {
      throw new SearchError(condition);
    }
    resultingPings.push(telemetryArray[index]);
  }
  return resultingPings;
}

export class SearchError extends Error {
  constructor(condition) {
    const message = `Could not find ping satisfying condition: ${condition.toString()}`;
    super(message);
    this.message = message;
    this.name = "SearchError";
  }
}

export default {
  getTelemetryPings,
  getShieldPingsAfterTimestamp,
  summarizePings,
  searchTelemetry,
  SearchError,
};
