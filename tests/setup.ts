import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll } from 'vitest';

export const mswServer = setupServer();

// Fail loudly if a handler is missing — prevents silent network hits
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
