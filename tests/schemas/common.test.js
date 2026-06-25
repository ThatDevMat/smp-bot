/**
 * Tests for src/schemas/common.js
 *
 * Covers every primitive schema exported by the common schemas module.
 */

const {
  MinecraftUsername,
  MinecraftUUID,
  Dimension,
  Coordinate,
  FutureDate,
  TimeString,
  Timezone,
  DiscordSnowflake,
  ISODate,
} = require('../../src/schemas/common');

/* ------------------------------------------------------------------ */
/*  MinecraftUsername                                                   */
/* ------------------------------------------------------------------ */

describe('MinecraftUsername', () => {
  it('should accept a valid username', () => {
    expect(MinecraftUsername.parse('Steve')).toBe('Steve');
  });

  it('should accept usernames with underscores and numbers', () => {
    expect(MinecraftUsername.parse('Player_123')).toBe('Player_123');
  });

  it('should reject a username shorter than 3 characters', () => {
    const result = MinecraftUsername.safeParse('ab');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('3');
  });

  it('should reject a username longer than 16 characters', () => {
    const result = MinecraftUsername.safeParse('a'.repeat(17));
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('16');
  });

  it('should reject a username with illegal characters', () => {
    const result = MinecraftUsername.safeParse('Steve!');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('letters');
  });

  it('should reject empty string', () => {
    expect(MinecraftUsername.safeParse('').success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  MinecraftUUID                                                       */
/* ------------------------------------------------------------------ */

describe('MinecraftUUID', () => {
  it('should accept a valid UUID v4', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(MinecraftUUID.parse(uuid)).toBe(uuid);
  });

  it('should reject an invalid UUID format', () => {
    const result = MinecraftUUID.safeParse('not-a-uuid');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('UUID');
  });

  it('should reject a UUID without hyphens', () => {
    const result = MinecraftUUID.safeParse('550e8400e29b41d4a716446655440000');
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Dimension                                                           */
/* ------------------------------------------------------------------ */

describe('Dimension', () => {
  it('should accept overworld', () => {
    expect(Dimension.parse('overworld')).toBe('overworld');
  });

  it('should accept nether', () => {
    expect(Dimension.parse('nether')).toBe('nether');
  });

  it('should accept end and transform to the_end', () => {
    expect(Dimension.parse('end')).toBe('the_end');
  });

  it('should accept the_end', () => {
    expect(Dimension.parse('the_end')).toBe('the_end');
  });

  it('should reject an invalid dimension', () => {
    const result = Dimension.safeParse('ocean');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('Dimension');
  });
});

/* ------------------------------------------------------------------ */
/*  Coordinate                                                          */
/* ------------------------------------------------------------------ */

describe('Coordinate', () => {
  it('should accept a valid coordinate', () => {
    expect(Coordinate.parse(100)).toBe(100);
  });

  it('should accept zero', () => {
    expect(Coordinate.parse(0)).toBe(0);
  });

  it('should reject a non-integer', () => {
    const result = Coordinate.safeParse(10.5);
    expect(result.success).toBe(false);
  });

  it('should reject a coordinate below world border', () => {
    const result = Coordinate.safeParse(-30000000);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('world border');
  });

  it('should reject a coordinate above world border', () => {
    const result = Coordinate.safeParse(30000000);
    expect(result.success).toBe(false);
  });

  it('should reject a non-number', () => {
    const result = Coordinate.safeParse('abc');
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  FutureDate                                                          */
/* ------------------------------------------------------------------ */

describe('FutureDate', () => {
  it('should accept a future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const dateStr = future.toISOString().slice(0, 10);
    expect(FutureDate.parse(dateStr)).toBe(dateStr);
  });

  it('should reject a past date', () => {
    const result = FutureDate.safeParse('2020-01-01');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('future');
  });

  it('should reject an invalid date format', () => {
    const result = FutureDate.safeParse('01-15-2026');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('YYYY-MM-DD');
  });

  it('should reject a malformed date string', () => {
    const result = FutureDate.safeParse('not-a-date');
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  TimeString                                                          */
/* ------------------------------------------------------------------ */

describe('TimeString', () => {
  it('should accept a valid time', () => {
    expect(TimeString.parse('14:30')).toBe('14:30');
  });

  it('should accept midnight', () => {
    expect(TimeString.parse('00:00')).toBe('00:00');
  });

  it('should accept 23:59', () => {
    expect(TimeString.parse('23:59')).toBe('23:59');
  });

  it('should reject an invalid hour (24)', () => {
    const result = TimeString.safeParse('24:00');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('HH:MM');
  });

  it('should reject an invalid minute (60)', () => {
    const result = TimeString.safeParse('12:60');
    expect(result.success).toBe(false);
  });

  it('should reject a non-time string', () => {
    const result = TimeString.safeParse('hello');
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Timezone                                                            */
/* ------------------------------------------------------------------ */

describe('Timezone', () => {
  it('should accept UTC', () => {
    expect(Timezone.parse('UTC')).toBe('UTC');
  });

  it('should accept a valid IANA timezone', () => {
    expect(Timezone.parse('America/New_York')).toBe('America/New_York');
  });

  it('should reject an invalid timezone string', () => {
    const result = Timezone.safeParse('Not/A/Timezone');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('IANA');
  });

  it('should reject empty string', () => {
    const result = Timezone.safeParse('');
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  DiscordSnowflake                                                    */
/* ------------------------------------------------------------------ */

describe('DiscordSnowflake', () => {
  it('should accept a valid snowflake', () => {
    expect(DiscordSnowflake.parse('123456789012345678')).toBe(
      '123456789012345678',
    );
  });

  it('should reject a string that is too short', () => {
    const result = DiscordSnowflake.safeParse('12345');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('Discord');
  });

  it('should reject a string with letters', () => {
    const result = DiscordSnowflake.safeParse('abc12345678901234');
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  ISODate                                                             */
/* ------------------------------------------------------------------ */

describe('ISODate', () => {
  it('should accept a valid ISO date', () => {
    expect(ISODate.parse('2026-01-15')).toBe('2026-01-15');
  });

  it('should reject an invalid format', () => {
    const result = ISODate.safeParse('01/15/2026');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('YYYY-MM-DD');
  });
});
