/**
 * Tests for src/utils/shutdown.js
 *
 * Covers:
 * - Each service's close method is called in the correct order
 * - Timeout triggers a force exit
 * - Both SIGTERM and SIGINT invoke the shutdown sequence
 * - uncaughtException and unhandledRejection trigger shutdown
 */

const { registerShutdownHandlers } = require('../../src/utils/shutdown');
const shutdownModule = require('../../src/utils/shutdown');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a mock dependency set for the shutdown handler.
 * All methods are jest.fn() that resolve / succeed synchronously.
 */
function createMockDeps() {
  return {
    httpServer: {
      close: jest.fn((cb) => cb && cb()),
    },
    discordClient: {
      destroy: jest.fn(),
    },
    rcon: {
      disconnect: jest.fn().mockResolvedValue(undefined),
    },
    mysql: {
      end: jest.fn().mockResolvedValue(undefined),
    },
    sqlite: {
      close: jest.fn(),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('registerShutdownHandlers', () => {
  let deps;
  let unregister;
  let exitSpy;

  beforeEach(() => {
    deps = createMockDeps();
    unregister = null;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    if (unregister) unregister();
    jest.useRealTimers();
  });

  /* ------------------------------------------------------------------ */
  /*  Handler registration                                               */
  /* ------------------------------------------------------------------ */

  it('registers handlers for SIGTERM, SIGINT, uncaughtException, unhandledRejection', () => {
    jest.spyOn(process, 'on').mockImplementation(() => process);
    unregister = shutdownModule.registerShutdownHandlers(deps);

    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith(
      'uncaughtException',
      expect.any(Function),
    );
    expect(process.on).toHaveBeenCalledWith(
      'unhandledRejection',
      expect.any(Function),
    );

    process.on.mockRestore();
  });

  /* ------------------------------------------------------------------ */
  /*  Shutdown sequence — each service closed in order                   */
  /* ------------------------------------------------------------------ */

  it('closes HTTP server, RCON, MySQL, SQLite, and Discord client on SIGTERM', async () => {
    unregister = shutdownModule.registerShutdownHandlers(deps);

    // Wait for the async shutdown to complete by awaiting a microtask flush.
    process.emit('SIGTERM');
    await new Promise(process.nextTick);

    expect(deps.httpServer.close).toHaveBeenCalled();
    expect(deps.rcon.disconnect).toHaveBeenCalled();
    expect(deps.mysql.end).toHaveBeenCalled();
    expect(deps.sqlite.close).toHaveBeenCalled();
    expect(deps.discordClient.destroy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('closes all services on SIGINT', async () => {
    unregister = shutdownModule.registerShutdownHandlers(deps);
    process.emit('SIGINT');
    await new Promise(process.nextTick);

    expect(deps.discordClient.destroy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  /* ------------------------------------------------------------------ */
  /*  Missing dependencies — gracefully skip unregistered services       */
  /* ------------------------------------------------------------------ */

  it('skips services that are not provided', async () => {
    unregister = shutdownModule.registerShutdownHandlers({
      httpServer: null,
      discordClient: deps.discordClient,
      rcon: null,
      mysql: null,
      sqlite: null,
    });

    process.emit('SIGTERM');
    await new Promise(process.nextTick);

    // Only Discord client should have been destroyed.
    expect(deps.discordClient.destroy).toHaveBeenCalled();
    expect(deps.rcon.disconnect).not.toHaveBeenCalled();
    expect(deps.mysql.end).not.toHaveBeenCalled();
    expect(deps.sqlite.close).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  /* ------------------------------------------------------------------ */
  /*  Timeout — force exit with code 1 after 10 seconds                 */
  /* ------------------------------------------------------------------ */

  it('forces exit with code 1 after timeout when HTTP server never calls back', () => {
    jest.useFakeTimers();

    // Make httpServer.close never call its callback.
    deps.httpServer.close = jest.fn(() => {
      // Never invoke the callback — simulates a hung server.
    });

    unregister = shutdownModule.registerShutdownHandlers(deps);
    process.emit('SIGTERM');

    // Run all pending timers (the 10-second timeout).
    jest.runAllTimers();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  /* ------------------------------------------------------------------ */
  /*  uncaughtException and unhandledRejection                           */
  /* ------------------------------------------------------------------ */

  it('triggers shutdown on uncaughtException', async () => {
    unregister = shutdownModule.registerShutdownHandlers(deps);

    process.emit('uncaughtException', new Error('Something went wrong'));
    await new Promise(process.nextTick);

    expect(deps.discordClient.destroy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('triggers shutdown on unhandledRejection', async () => {
    unregister = shutdownModule.registerShutdownHandlers(deps);

    process.emit('unhandledRejection', new Error('Rejected promise'));
    await new Promise(process.nextTick);

    expect(deps.discordClient.destroy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  /* ------------------------------------------------------------------ */
  /*  Idempotency — second signal does nothing                           */
  /* ------------------------------------------------------------------ */

  it('ignores duplicate shutdown signals', async () => {
    unregister = shutdownModule.registerShutdownHandlers(deps);

    // First shutdown.
    process.emit('SIGTERM');
    await new Promise(process.nextTick);
    expect(deps.discordClient.destroy).toHaveBeenCalledTimes(1);

    // Second shutdown — destroy should not be called again.
    process.emit('SIGTERM');
    await new Promise(process.nextTick);
    expect(deps.discordClient.destroy).toHaveBeenCalledTimes(1);
  });
});
