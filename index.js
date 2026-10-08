const app = require('./server');

module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (err) {
    console.error('[SERVERLESS INVOCATION ERROR]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Serverless Execution Error', message: err.message }));
    }
  }
};
