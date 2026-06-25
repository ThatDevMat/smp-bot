/**
 * Tests for src/webhooks/discordsrv.js
 *
 * Tests Express route handlers via supertest (no real HTTP server).
 * The Discord client is mocked so no API calls are made.
 */

const request = require('supertest');
const discordsrv = require('../../src/webhooks/discordsrv');

/* ------------------------------------------------------------------ */
/*  Factory: fake Discord client                                       */
/* ------------------------------------------------------------------ */

function createFakeClient() {
  const channelSend = jest.fn().mockResolvedValue(undefined);
  return {
    channels: {
      fetch: jest.fn().mockResolvedValue({ send: channelSend }),
    },
    _channelSend: channelSend,
  };
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                   */
/* ------------------------------------------------------------------ */

beforeAll(() => {
  // Prevent init() from binding to a real port — supertest uses its
  // own ephemeral server via the Express app directly.
  const express = require('express');
  jest
    .spyOn(express.application, 'listen')
    .mockReturnValue({ close: jest.fn() });
});

afterAll(() => {
  jest.restoreAllMocks();
});

let client;

function getApp() {
  const app = discordsrv.getApp();
  if (!app) throw new Error('init() must be called before getApp()');
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  client = createFakeClient();
  discordsrv.init(client);
});

/* ------------------------------------------------------------------ */
/*  Secret validation                                                  */
/* ------------------------------------------------------------------ */

describe('secret validation middleware', () => {
  it('should return 401 when webhook secret is missing', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .send({ type: 'chat', username: 'Steve', message: 'Hi' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid webhook secret');
    expect(client._channelSend).not.toHaveBeenCalled();
  });

  it('should return 401 when webhook secret is wrong', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'wrong-secret')
      .send({ type: 'chat', username: 'Steve', message: 'Hi' });

    expect(res.status).toBe(401);
  });

  it('should accept requests with the correct secret', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'chat', username: 'Steve', message: 'Hi' });

    expect(res.status).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/*  Chat messages                                                      */
/* ------------------------------------------------------------------ */

describe('POST /srvchat — chat events', () => {
  it('should relay type "chat" payloads', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'chat', username: 'Steve', message: 'Hello!' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(client._channelSend).toHaveBeenCalled();
  });

  it('should handle type "global" as chat', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ channel: 'global', username: 'Alex', message: 'Hey' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(client._channelSend).toHaveBeenCalled();
  });

  it('should handle channel:global with explicit type:chat (both fields)', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ channel: 'global', type: 'chat', username: 'Alex', message: 'Hey' });

    expect(res.status).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/*  Player events                                                      */
/* ------------------------------------------------------------------ */

describe('POST /srvchat — player events', () => {
  it('should relay join events', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'join', username: 'Steve' });

    expect(res.status).toBe(200);
    expect(client._channelSend).toHaveBeenCalled();
  });

  it('should relay leave events', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'leave', username: 'Alex' });

    expect(res.status).toBe(200);
    expect(client._channelSend).toHaveBeenCalled();
  });

  it('should relay death events', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'death', username: 'Steve', message: 'Steve fell' });

    expect(res.status).toBe(200);
    expect(client._channelSend).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Advancement events                                                 */
/* ------------------------------------------------------------------ */

describe('POST /srvchat — advancement events', () => {
  it('should relay advancement unlocks', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({
        type: 'advancement',
        username: 'Steve',
        message: 'Getting Wood',
        description: 'Punch a tree',
      });

    expect(res.status).toBe(200);
    expect(client._channelSend).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Server start / stop                                                */
/* ------------------------------------------------------------------ */

describe('POST /srvchat — server events', () => {
  it('should relay server start events', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'start' });

    expect(res.status).toBe(200);
    expect(client._channelSend).toHaveBeenCalled();
  });

  it('should relay server stop events', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'stop' });

    expect(res.status).toBe(200);
    expect(client._channelSend).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Health check                                                       */
/* ------------------------------------------------------------------ */

describe('GET /health', () => {
  it('should return status ok with uptime', async () => {
    const res = await request(getApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Edge cases                                                         */
/* ------------------------------------------------------------------ */

describe('POST /srvchat — edge cases', () => {
  it('should return 400 when body is not an object (e.g. a string)', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .set('Content-Type', 'application/json')
      .send('""');

    expect(res.status).toBe(400);
    expect(client._channelSend).not.toHaveBeenCalled();
  });

  it('should handle payload with an empty object', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should reject unknown event types with 400', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({
        type: 'custom_event',
        username: 'Server',
        message: 'Something happened',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should return 400 when required fields are missing from a typed payload', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'chat' }); // missing username and message

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
    expect(res.body.details).toBeDefined();
  });

  it('should return 400 when join payload has no username', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'join' }); // missing username

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should handle database errors gracefully in relayMessage', async () => {
    client.channels.fetch.mockRejectedValue(new Error('Unknown Channel'));

    // Use a message that will pass Zod validation but hit a channel
    // fetch error in relayMessage.
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .send({ type: 'chat', username: 'Test', message: 'Hello' });

    // The route catches the error and still responds 200 to the webhook
    // caller — the error is only logged internally.
    expect(res.status).toBe(200);
  });

  it('should return 400 when payload body is a string', async () => {
    const res = await request(getApp())
      .post('/srvchat')
      .set('x-webhook-secret', 'test-webhook-secret')
      .set('Content-Type', 'application/json')
      .send('""');

    expect(res.status).toBe(400);
  });
});
