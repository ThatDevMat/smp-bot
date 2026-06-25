/**
 * Player identifier resolution utility.
 *
 * Accepts either a Minecraft username (resolved via Mojang API) or
 * a raw UUID string, and returns a normalised { uuid, username } pair.
 * Every staff command that takes a "player" argument should route through
 * this function so that UUID resolution logic lives in exactly one place.
 */

const mojang = require('../integrations/mojang');

const UUID_PATTERN = /^[a-fA-F0-9-]{32,36}$/;

/**
 * Resolve a player identifier to a UUID and display name.
 *
 * @param {string} input - Minecraft username or hyphenated / plain UUID.
 * @returns {Promise<{uuid: string, username: string}|null>}
 *   `null` when a username lookup returns no Mojang profile.
 */
async function resolvePlayer(input) {
  if (UUID_PATTERN.test(input)) {
    // Already a UUID – strip hyphens, use input as display name.
    return { uuid: input.replace(/-/g, ''), username: input };
  }

  const profile = await mojang.getUuidByUsername(input);
  if (!profile) return null;

  return { uuid: profile.uuid, username: profile.username };
}

module.exports = { resolvePlayer };
