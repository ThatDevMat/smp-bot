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

/**
 * Console command input schema.
 * Blocks dangerous server-management commands that should only be run via SSH.
 */
const DANGEROUS_COMMAND_RE =
  /^(stop|restart|reload|op|deop|ban|pardon|kick|say)(\s|$)/i;

const ConsoleInput = z.object({
  command: z
    .string({ required_error: 'Command is required' })
    .min(1, 'Command must be at least 1 character')
    .max(200, 'Command must be 200 characters or fewer')
    .refine(
      (val) => !DANGEROUS_COMMAND_RE.test(val.trim()),
      'This command is blocked for safety. Use SSH for server management commands (stop, restart, reload, op, deop, ban, pardon, kick, say).',
    ),
});

/**
 * Announcement creation input schema.
 * Cron expression is validated separately in the handler via node-cron.validate().
 */
const AnnounceCreateInput = z.object({
  channel: z
    .string({ required_error: 'Channel is required' })
    .min(1, 'Channel is required'),
  message: z
    .string({ required_error: 'Message is required' })
    .min(1, 'Message must be at least 1 character')
    .max(1500, 'Message must be 1500 characters or fewer'),
  cron: z
    .string({ required_error: 'Cron expression is required' })
    .min(1, 'Cron expression is required'),
});

const AnnounceCancelInput = z.object({
  id: z
    .number({ required_error: 'Announcement ID is required' })
    .int('ID must be an integer')
    .positive('ID must be a positive number'),
});

// ---- Player Notes -----------------------------------------------------

const NoteAddInput = z.object({
  player: z
    .string({ required_error: 'Player name or UUID is required' })
    .min(1, 'Player name or UUID is required'),
  note: z
    .string({ required_error: 'Note is required' })
    .min(1, 'Note must be at least 1 character')
    .max(500, 'Note must be 500 characters or fewer'),
});

const NoteListInput = z.object({
  player: z
    .string({ required_error: 'Player name or UUID is required' })
    .min(1, 'Player name or UUID is required'),
});

const NoteRemoveInput = z.object({
  id: z
    .number({ required_error: 'Note ID is required' })
    .int('ID must be an integer')
    .positive('ID must be a positive number'),
});

module.exports = {
  WarnInput,
  CheckPunishmentsInput,
  ConsoleInput,
  AnnounceCreateInput,
  AnnounceCancelInput,
  NoteAddInput,
  NoteListInput,
  NoteRemoveInput,
};
