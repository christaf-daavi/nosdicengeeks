const path = require('path');
// .env.local tiene prioridad para desarrollo local (gitignored, no pisa el
// .env de los servidores dev/prod). dotenv no sobreescribe variables ya
// definidas, así que cargarlo primero le da precedencia sobre .env.
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler (incluye errores de Multer)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Archivo demasiado grande. Máximo 10MB' });
  }
  if (err.message && err.message.startsWith('Tipo de archivo no permitido')) {
    return res.status(415).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`NosDicenGeeks Admin corriendo en http://localhost:${PORT}`);
});
