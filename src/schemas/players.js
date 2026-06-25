/**
 * Player management Zod schemas.
 *
 * Validates inputs for /register, /whois, and /whitelist.
 */

const z = require('zod');
const { MinecraftUsername, DiscordSnowflake } = require('./common');

const RegisterInput = z.object({
  minecraftUsername: MinecraftUsername,
});

const WhoisInput = z.object({
  user: DiscordSnowflake,
});

const WhitelistInput = z.object({
  username: MinecraftUsername,
});

module.exports = { RegisterInput, WhoisInput, WhitelistInput };
