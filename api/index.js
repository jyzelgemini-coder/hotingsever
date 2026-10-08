const app = require('../server');

module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (err) {
    console.error('[SERVERLESS INVOCATION ERROR]', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
