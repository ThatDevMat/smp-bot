/**
 * Common Zod primitives shared across all domain schemas.
 *
 * Every validation rule and user-facing error message lives here so
 * that command and webhook schemas can reuse them without duplicating
 * constraints or string messages.
 */

const z = require('zod');

/**
 * Minecraft username — 3–16 alphanumeric + underscore characters.
 */
const MinecraftUsername = z
  .string()
  .min(3, 'Minecraft usernames can only contain letters, numbers, and underscores (3\u201316 characters)')
  .max(16, 'Minecraft usernames can only contain letters, numbers, and underscores (3\u201316 characters)')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Minecraft usernames can only contain letters, numbers, and underscores (3\u201316 characters)',
  );

/**
 * Minecraft UUID — standard UUID v4 format.
 */
const MinecraftUUID = z
  .string()
  .uuid({ message: 'Invalid Minecraft UUID format' });

/**
 * Dimension — one of the three Minecraft dimensions.
 * Note: the DB uses 'the_end' but the schema accepts both 'end' and 'the_end'.
 */
const Dimension = z
  .string({ required_error: 'Dimension is required' })
  .refine(
    (val) => ['overworld', 'nether', 'end', 'the_end'].includes(val),
    {
      message: 'Dimension must be overworld, nether, or end',
    },
  )
  .transform((val) => (val === 'end' ? 'the_end' : val));

/**
 * Coordinate — integer within the Minecraft world border.
 */
const Coordinate = z
  .number({ invalid_type_error: 'Coordinate must be a number' })
  .int('Coordinate must be a whole number')
  .min(-29999984, 'Coordinate is outside the Minecraft world border')
  .max(29999984, 'Coordinate is outside the Minecraft world border');

/**
 * FutureDate — ISO 8601 date string (YYYY-MM-DD) that must be in the future.
 */
const FutureDate = z
  .string({ required_error: 'Date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(
    (val) => {
      const parsed = new Date(val + 'T00:00:00Z');
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed > new Date();
    },
    { message: 'Event date must be in the future' },
  );

/**
 * TimeString — HH:MM 24-hour format.
 */
const TimeString = z
  .string({ required_error: 'Time is required' })
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    'Time must be in HH:MM 24-hour format',
  );

/**
 * IANA timezone string — validated against the Intl API.
 */
const Timezone = z
  .string({ required_error: 'Timezone is required' })
  .refine(
    (val) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: val });
        return true;
      } catch {
        return false;
      }
    },
    {
      message:
        'Invalid timezone. Use an IANA timezone name such as America/New_York or Europe/London',
    },
  );

/**
 * Discord Snowflake — 17–19 digit numeric ID.
 */
const DiscordSnowflake = z
  .string({ required_error: 'Discord user ID is required' })
  .regex(/^\d{17,19}$/, 'Invalid Discord ID');

/**
 * ISO 8601 date (YYYY-MM-DD) — may be in the past (used for season start dates).
 */
const ISODate = z
  .string({ required_error: 'Date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

module.exports = {
  MinecraftUsername,
  MinecraftUUID,
  Dimension,
  Coordinate,
  FutureDate,
  TimeString,
  Timezone,
  DiscordSnowflake,
  ISODate,
};
