/**
 * Moderation Zod schemas.
 *
 * Validates inputs for /warn, /checkbans, /history, and /warnings.
 */

const z = require('zod');
const { MinecraftUsername } = require('./common');

const WarnInput = z.object({
  player: MinecraftUsername,
  reason: z
    .string({ required_error: 'Reason is required' })
    .min(5, 'Reason must be at least 5 characters')
    .max(200, 'Reason must be 200 characters or fewer'),
});

const CheckPunishmentsInput = z.object({
  player: z
    .string({ required_error: 'Player name or UUID is required' })
    .min(1, 'Player name or UUID is required'),
});

module.exports = { WarnInput, CheckPunishmentsInput };
