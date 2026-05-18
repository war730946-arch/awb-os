module.exports = (req, res) => {
  res.json({ status: 'ok', system: 'AWB-OS', version: '1.0.0', message: 'Health check passed' });
};