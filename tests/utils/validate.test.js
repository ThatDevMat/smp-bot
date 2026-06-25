/**
 * Tests for src/utils/validate.js
 */

const { validateInput, ValidationError } = require('../../src/utils/validate');
const z = require('zod');

describe('validate.js', () => {
  const testSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    age: z.number().int().positive('Age must be positive'),
  });

  it('should return parsed data on valid input', () => {
    const result = validateInput(testSchema, { name: 'Steve', age: 25 });
    expect(result).toEqual({ name: 'Steve', age: 25 });
  });

  it('should throw ValidationError with a user-friendly message on invalid input', () => {
    expect.assertions(3);

    try {
      validateInput(testSchema, { name: 'ab', age: -1 });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.userMessage).toBe('Name must be at least 3 characters');
      expect(err.zodError).toBeDefined();
    }
  });

  it('should not throw ZodError directly', () => {
    expect.assertions(2);

    try {
      validateInput(testSchema, { name: '', age: 0 });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.constructor.name).not.toBe('ZodError');
    }
  });

  it('should handle completely missing data', () => {
    expect.assertions(1);

    try {
      validateInput(testSchema, {});
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });

  it('should handle null data', () => {
    expect.assertions(1);

    try {
      validateInput(testSchema, null);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });

  it('should include the full zodError for logging', () => {
    expect.assertions(2);

    try {
      validateInput(testSchema, { name: 'ab', age: -1 });
    } catch (err) {
      expect(err.zodError.issues).toBeInstanceOf(Array);
      expect(err.zodError.issues.length).toBeGreaterThan(0);
    }
  });

  it('should apply Zod transforms (e.g. defaults)', () => {
    const schemaWithDefault = z.object({
      role: z.string().optional().default('member'),
    });

    const result = validateInput(schemaWithDefault, {});
    expect(result.role).toBe('member');
  });
});
