/**
 * Validation helper.
 *
 * Wraps Zod's safeParse so that callers never handle raw ZodError
 * instances.  Throws a ValidationError with both a user-friendly message
 * (for Discord ephemeral replies) and the full Zod error object (for
 * server-side logging).
 *
 * Usage:
 *   const input = validateInput(CreateEventSchema, rawData);
 *
 * On failure a ValidationError is thrown.  Catch it in the command
 * handler and reply with `err.userMessage`.
 */

const logger = require('./logger');

class ValidationError extends Error {
  /**
   * @param {string} userMessage  Human-readable error for end-users.
   * @param {z.ZodError} zodError  The full Zod validation error (for logging).
   */
  constructor(userMessage, zodError) {
    super(userMessage);
    this.name = 'ValidationError';
    this.zodError = zodError;
    this.userMessage = userMessage;
  }
}

/**
 * Validate data against a Zod schema.
 *
 * @param {z.ZodType} schema
 * @param {unknown} data
 * @returns {unknown} Parsed (and potentially transformed) data.
 * @throws {ValidationError} On validation failure.
 */
function validateInput(schema, data) {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Extract the first user-facing error message.
    // Zod always provides a message for each issue, so the fallback
    // is defensive only.
    const userMessage = result.error.issues[0]?.message || 'Invalid input';

    logger.debug('Validation failed', {
      data,
      issues: result.error.issues,
      schema: schema.description || schema.constructor?.name,
    });

    throw new ValidationError(userMessage, result.error);
  }

  return result.data;
}

module.exports = { validateInput, ValidationError };
