/* eslint-env node */

/**
 * Returns array of pings of type `type` in reverse sorted order by timestamp
 * first element is most recent ping
 *
 * searchTelemetryQuery
 * - type:  string or array of ping types
 * - n:  positive integer. at most n pings.
 * - timestamp:  only pings after this timestamp.
 * - headersOnly: boolean, just the 'headers' for the pings, not the full bodies.
 *
 * TODO: Fix shortcoming:
 * Some pings are sent immediately after one another and it's
 * original sending order is not reflected by the return of
 * TelemetryArchive.promiseArchivedPingList
 * Thus, we can currently only test that the last two pings are the
 * correct ones but not that their order is correct
 */
async function searchTelemetryArchive(
  ErrorToThrow,
  TelemetryArchive,
  searchTelemetryQuery,
) {
  let { type } = searchTelemetryQuery;
  const { n, timestamp, headersOnly } = searchTelemetryQuery;
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

  if (pings.length === 0) {
    throw new ErrorToThrow(searchTelemetryQuery);
  }

  if (n) pings = pings.slice(0, n);
  const pingData = headersOnly
    ? pings
    : pings.map(ping => TelemetryArchive.promiseArchivedPingById(ping.id));

  return Promise.all(pingData);
}

class SearchError extends Error {
  constructor(searchTelemetryQuery) {
    const message = `Could not find ping satisfying query: ${searchTelemetryQuery.toString()}`;
    super(message);
    this.message = message;
    this.name = "SearchError";
  }
}

module.exports = {
  searchTelemetryArchive,
  SearchError,
};
