const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.get('/ping', (req, res) => {
  res.status(200).json({ message: 'pong' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Test Server] Listening for pings on http://localhost:${PORT}`);
});
