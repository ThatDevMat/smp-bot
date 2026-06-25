/**
 * DiscordSRV webhook payload Zod schemas.
 *
 * Defines typed payload shapes for every event DiscordSRV can send.
 * A discriminated union on the `type` field ensures exhaustive handling.
 *
 * Payload field naming follows the DiscordSRV plugin documentation.
 */

const z = require('zod');

const ChatPayload = z.object({
  type: z.literal('chat'),
  username: z.string({ required_error: 'username is required' }),
  message: z.string({ required_error: 'message is required' }),
  world: z.string().optional().default(''),
});

const _GlobalPayload = z.object({
  channel: z.literal('global'),
  username: z.string().optional().default(''),
  message: z.string().optional().default(''),
});

const JoinPayload = z.object({
  type: z.literal('join'),
  username: z.string({ required_error: 'username is required' }),
});

const LeavePayload = z.object({
  type: z.literal('leave'),
  username: z.string({ required_error: 'username is required' }),
});

const DeathPayload = z.object({
  type: z.literal('death'),
  username: z.string().optional().default(''),
  message: z.string().optional().default(''),
});

const AdvancementPayload = z.object({
  type: z.literal('advancement'),
  username: z.string({ required_error: 'username is required' }),
  advancement: z.string().optional().default('Unknown Advancement'),
  advancementTitle: z.string().optional().default('Unknown Advancement'),
  advancementDescription: z.string().optional().default(''),
  message: z.string().optional().default(''),
  description: z.string().optional().default(''),
});

const ServerStartPayload = z.object({
  type: z.literal('start'),
});

const ServerStopPayload = z.object({
  type: z.literal('stop'),
});

/**
 * Union of all known DiscordSRV payload shapes, discriminated by `type`.
 * Also accepts the legacy `channel: 'global'` format.
 */
const DiscordSRVPayload = z.discriminatedUnion('type', [
  ChatPayload,
  JoinPayload,
  LeavePayload,
  DeathPayload,
  AdvancementPayload,
  ServerStartPayload,
  ServerStopPayload,
]);

module.exports = {
  DiscordSRVPayload,
  ChatPayload,
  JoinPayload,
  LeavePayload,
  DeathPayload,
  AdvancementPayload,
  ServerStartPayload,
  ServerStopPayload,
};
