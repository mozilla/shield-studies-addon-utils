const { utils: Cu } = Components;
Cu.import("resource://gre/modules/Services.jsm");
const { TextEncoder } = Cu.getGlobalForObject(Services);

/**
 * Given sample weights (weightedVariations) and a particular position
 * (fraction), return a variation.  If no fraction given, return a variation
 * at random fraction proportional to the weightVariations object
 * @param {Object[]} weightedVariations - the array of branch name:weight pairs
 * used to randomly assign the user to a branch
 * @param {Number} fraction - a number (0 <= fraction < 1)
 * @returns {Object} - the variation object in weightedVariations for the given
 * fraction
 */
export function chooseWeighted(weightedVariations, fraction = Math.random()) {
  /*
   weightedVaiations, list of:
   {
    name: string of any length
    weight: float >= 0
   }
  */

  const weights = weightedVariations.map(x => x.weight || 1);
  const partial = cumsum(weights);
  const total = weights.reduce((a, b) => a + b);
  for (let ii = 0; ii < weightedVariations.length; ii++) {
    if (fraction <= partial[ii] / total) {
      return weightedVariations[ii];
    }
  }
  return null;
}

/**
 * @async
 * Converts a string into a fraction (0 <= fraction < 1) based on the first
 * X bits of its sha256 hexadecimal representation
 * Note: Salting (adding the study name to the telemetry clientID) ensures
 * that the same user gets a different bucket/hash for each study.
 * Hashing of the salted string ensures uniform hashing; i.e. that every
 * bucket/variation gets filled.
 * @param {string} saltedString - a salted string used to create a hash for
 * the user
 * @param {Number} bits - The first number of bits to use in the sha256 hex
 * representation
 * @returns {Number} - a fraction (0 <= fraction < 1)
 */
export async function hashFraction(saltedString, bits = 12) {
  const hash = await sha256(saltedString);
  return parseInt(hash.substr(0, bits), 16) / Math.pow(16, bits);
}

/**
 * @async
 * Converts a string into its sha256 hexadecimal representation.
 * Note: This is ultimately used to make a hash of the user's telemetry clientID
 * and the study name.
 * @param {string} message - The message to convert.
 * @returns {string} - a hexadecimal, 256-bit hash
 */
export async function sha256(message) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder("utf-8").encode(message);
  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // convert bytes to hex string
  const hashHex = hashArray
    .map(b => ("00" + b.toString(16)).slice(-2))
    .join("");
  return hashHex;
}

/**
 * Converts an array of length N into a cumulative sum array of length N,
 * where n_i = sum(array.slice(0,i)) i.e. each element is the sum of all
 * elements up to and including that element
 * This is ultimately used for turning sample weights (AKA weightedVariations)
 * into right hand limits (>= X) to  deterministically select which variation
 * a user receives.
 * @example [.25,.3,.45] => [.25,.55,1.0]; if a user's sample weight were .25,
 * they would fall into the left-most bucket
 * @param {Number[]} arr - An array of sample weights (0 <= sample weight < 1)
 * @returns {Number[]} - A cumulative sum array of sample weights
 * (0 <= sample weight <= 1)
 */
export function cumsum(arr) {
  return arr.reduce(function(r, c, i) {
    r.push((r[i - 1] || 0) + c);
    return r;
  }, []);
}

export default {
  chooseWeighted,
  cumsum,
  hashFraction,
  sha256,
};
