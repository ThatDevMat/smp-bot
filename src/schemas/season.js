/**
 * Season management Zod schemas.
 *
 * Validates inputs for /season set.
 */

const z = require('zod');
const { ISODate } = require('./common');

const SetSeasonInput = z.object({
  number: z
    .number({ required_error: 'Season number is required' })
    .int('Season number must be a whole number')
    .positive('Season number must be positive')
    .max(999, 'Season number must be 999 or less'),
  startDate: ISODate,
  seed: z
    .string()
    .max(20, 'Seed must be 20 characters or fewer')
    .optional()
    .nullable()
    .default(null),
});

module.exports = { SetSeasonInput };
