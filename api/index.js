/**
 * Vercel Serverless Function Entrypoint
 * Wraps the Express app from backend/server.js as a Vercel serverless handler.
 */
const app = require('../backend/server.js');

module.exports = app;
