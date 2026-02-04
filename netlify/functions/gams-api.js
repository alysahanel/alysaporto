const serverless = require('serverless-http');
const app = require('../../gams/server');

module.exports.handler = serverless(app);
