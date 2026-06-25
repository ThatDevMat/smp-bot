/**
 * Event management Zod schemas.
 *
 * Validates inputs for /event create and /event cancel.
 */

const z = require('zod');
const { FutureDate, TimeString, Timezone } = require('./common');

const CreateEventInput = z.object({
  name: z
    .string({ required_error: 'Event name is required' })
    .min(3, 'Event name must be at least 3 characters')
    .max(50, 'Event name must be 50 characters or fewer'),
  date: FutureDate,
  time: TimeString,
  timezone: Timezone,
  description: z
    .string({ required_error: 'Description is required' })
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be 500 characters or fewer'),
});

const CancelEventInput = z.object({
  id: z
    .number({ required_error: 'Event ID is required' })
    .int('Event ID must be a whole number')
    .positive('Event ID must be a positive number'),
});

module.exports = { CreateEventInput, CancelEventInput };
