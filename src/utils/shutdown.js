/**
 * Graceful shutdown handler.
 *
 * Registers handlers for SIGTERM, SIGINT, uncaughtException, and
 * unhandledRejection.  Runs a coordinated shutdown sequence:
 *   1. Stop accepting new Discord interactions
 *   2. Close the Express HTTP server (drain in-flight requests)
 *   3. Disconnect RCON
 *   4. Close MySQL connection pool
 *   5. Close SQLite database
 *   6. Destroy Discord client
 *   7. Exit with code 0 (or 1 on timeout)
 *
 * If the full sequence takes longer than SHUTDOWN_TIMEOUT_MS (10 s)
 * the process force-exits with code 1.
 */

const logger = require('./logger');

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Register shutdown handlers.
 *
 * @param {object} deps
 * @param {import('http').Server} deps.httpServer   Express server instance
 * @param {import('discord.js').Client} deps.discordClient  Discord client
 * @param {object} deps.rcon     RCON wrapper (with disconnect())
 * @param {object} deps.mysql    MySQL pool (with end())
 * @param {import('better-sqlite3').Database} deps.sqlite  SQLite db instance
 */
function registerShutdownHandlers(deps) {
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    global.shuttingDown = true;

    logger.info('Shutdown initiated', { signal });

    const timeout = setTimeout(() => {
      logger.error('Shutdown timed out — forcing exit', { signal });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      // 1. Stop accepting new Discord interactions — mark as shut down.
      //    (The global flag is checked by interactionCreate.js)
      logger.info('Shutdown step 1/6 — marked bot as shutting down');

      // 2. Close the Express HTTP server.
      if (deps.httpServer) {
        logger.info('Shutdown step 2/6 — closing HTTP server');
        await new Promise((resolve) => deps.httpServer.close(resolve));
        logger.info('HTTP server closed');
      }

      // 3. Disconnect RCON.
      if (deps.rcon && typeof deps.rcon.disconnect === 'function') {
        logger.info('Shutdown step 3/6 — disconnecting RCON');
        await deps.rcon.disconnect().catch(() => {});
        logger.info('RCON disconnected');
      }

      // 4. Close MySQL pool.
      if (deps.mysql && typeof deps.mysql.end === 'function') {
        logger.info('Shutdown step 4/6 — closing MySQL pool');
        await deps.mysql.end();
        logger.info('MySQL pool closed');
      }

      // 5. Close SQLite database.
      if (deps.sqlite && typeof deps.sqlite.close === 'function') {
        logger.info('Shutdown step 5/6 — closing SQLite database');
        deps.sqlite.close();
        logger.info('SQLite database closed');
      }

      // 6. Destroy Discord client.
      if (deps.discordClient) {
        logger.info('Shutdown step 6/6 — destroying Discord client');
        deps.discordClient.destroy();
        logger.info('Discord client destroyed');
      }

      clearTimeout(timeout);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Shutdown error', { error: err.message, stack: err.stack });
      clearTimeout(timeout);
      process.exit(1);
    }
  }

  const sigtermHandler = () => shutdown('SIGTERM');
  const sigintHandler = () => shutdown('SIGINT');
  const uncaughtExceptionHandler = (err) => {
    logger.error('Uncaught exception', {
      error: err.message,
      stack: err.stack,
    });
    shutdown('uncaughtException');
  };
  const unhandledRejectionHandler = (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason?.stack || reason,
    });
    shutdown('unhandledRejection');
  };

  process.on('SIGTERM', sigtermHandler);
  process.on('SIGINT', sigintHandler);
  process.on('uncaughtException', uncaughtExceptionHandler);
  process.on('unhandledRejection', unhandledRejectionHandler);

  // Return a cleanup function for testing.
  return function unregister() {
    process.removeListener('SIGTERM', sigtermHandler);
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('uncaughtException', uncaughtExceptionHandler);
    process.removeListener('unhandledRejection', unhandledRejectionHandler);
    shuttingDown = false;
  };
}

module.exports = { registerShutdownHandlers };
