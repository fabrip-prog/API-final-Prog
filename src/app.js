require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const teamsRouter = require('./routes/teams');
const statsRouter = require('./routes/stats');
const { ensureDatabaseAndTables } = require('./database/db');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── Welcome route ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    mensaje: 'API de la Premier League — Temporada 2026/2027',
    temporada: '2026/2027',
    version: '1.0.0',
    endpoints: {
      todos_los_equipos:          'GET  /api/teams',
      buscar_equipos:             'GET  /api/teams?search=arsenal',
      filtrar_por_ciudad:         'GET  /api/teams?city=londres',
      ordenar_equipos:            'GET  /api/teams?sort_by=trophies&order=desc',
      paginar:                    'GET  /api/teams?page=1&limit=5',
      equipo_individual:          'GET  /api/teams/:id',
      equipo_por_tla:             'GET  /api/teams/ars',
      estadio_del_equipo:         'GET  /api/teams/:id/stadium',
      palmares_del_equipo:        'GET  /api/teams/:id/honours',
      director_tecnico_del_equipo:'GET  /api/teams/:id/manager',
      estadisticas_ciudades:      'GET  /api/stats/cities',
      estadisticas_trofeos:       'GET  /api/stats/trophies',
      estadisticas_estadios:      'GET  /api/stats/stadiums',
      estadisticas_resumen:       'GET  /api/stats/overview',
    },
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/teams', teamsRouter);
app.use('/api/stats', statsRouter);

// ── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await ensureDatabaseAndTables();
  } catch (err) {
    console.warn(' Advertencia: No se pudo verificar la base de datos MySQL en el arranque:', err.message);
    console.warn(' Asegúrate de que XAMPP tenga el módulo MySQL activo (puerto 3306).');
  }

  app.listen(PORT, () => {
    console.log(`\n  API de la Premier League corriendo en http://localhost:${PORT}`);
    console.log(` Resumen de endpoints:        http://localhost:${PORT}`);
    console.log(` Todos los equipos:           http://localhost:${PORT}/api/teams`);
    console.log(` Estadísticas de la liga:     http://localhost:${PORT}/api/stats/overview\n`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
