const express = require('express');
const path = require('path');
const app = express();

const PORT = 7991;
const DIST_DIR = path.join(__dirname, 'dist');

app.use(express.static(DIST_DIR));

// Use middleware instead of wildcard route for Express 5.x
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend serving on port ${PORT}`);
});
