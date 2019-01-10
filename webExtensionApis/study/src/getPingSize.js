/* eslint-env commonjs */

/**
 * Calculate the size of a ping.
 *
 * @param {Object} payload
 *   The data payload of the ping.
 *
 * @returns {Number}
 *   The total size of the ping.
 */
function getPingSize(payload) {
  const converter = Cc[
    "@mozilla.org/intl/scriptableunicodeconverter"
  ].createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let utf8Payload = converter.ConvertFromUnicode(JSON.stringify(payload));
  utf8Payload += converter.Finish();
  return utf8Payload.length;
}

module.exports = {
  getPingSize,
};
