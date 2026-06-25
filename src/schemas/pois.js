/**
 * POI (Point of Interest) Zod schemas.
 *
 * Validates inputs for /poi add and /poi remove.
 */

const z = require('zod');
const { Coordinate, Dimension } = require('./common');

const AddPOIInput = z.object({
  name: z
    .string({ required_error: 'POI name is required' })
    .min(2, 'POI name must be at least 2 characters')
    .max(40, 'POI name must be 40 characters or fewer'),
  x: Coordinate,
  y: z
    .number({ invalid_type_error: 'Y coordinate must be a number' })
    .int('Y coordinate must be a whole number')
    .min(-64, 'Y coordinate is below the build limit')
    .max(320, 'Y coordinate is above the build limit'),
  z: Coordinate,
  dimension: Dimension,
  description: z
    .string({ required_error: 'Description is required' })
    .min(5, 'Description must be at least 5 characters')
    .max(200, 'Description must be 200 characters or fewer'),
});

const RemovePOIInput = z.object({
  name: z
    .string({ required_error: 'POI name is required' })
    .min(2, 'POI name must be at least 2 characters')
    .max(40, 'POI name must be 40 characters or fewer'),
});

module.exports = { AddPOIInput, RemovePOIInput };
