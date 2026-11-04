const express = require('express');
const router = express.Router();
const TeamsController = require('../controllers/teams.controller');

// ═══════════════════════════════════════════════════════════════════════════════
//  RUTAS DE EQUIPOS (CRUD Completo: GET, POST, PUT, DELETE)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/teams
 * Listar todos los equipos. Soporta búsqueda, filtros, ordenación y paginación.
 */
router.get('/', TeamsController.getAllTeams);

/**
 * GET /api/teams/:id
 * Obtener un equipo individual por su ID slug o código TLA.
 */
router.get('/:id', TeamsController.getTeamById);

/**
 * POST /api/teams
 * Registrar un nuevo equipo con todas sus tablas relacionales.
 */
router.post('/', TeamsController.createTeam);

/**
 * PUT /api/teams/:id
 * Actualizar de forma completa un equipo existente por su ID o TLA.
 */
router.put('/:id', TeamsController.updateTeam);

/**
 * DELETE /api/teams/:id
 * Eliminar un equipo (con eliminación en cascada de sus tablas secundarias).
 */
router.delete('/:id', TeamsController.deleteTeam);

// ── Subrecursos específicos ───────────────────────────────────────────────────

/**
 * GET /api/teams/:id/stadium
 * Obtener la información del estadio de un equipo.
 */
router.get('/:id/stadium', TeamsController.getTeamStadium);

/**
 * GET /api/teams/:id/honours
 * Obtener la vitrina de trofeos y títulos de un equipo.
 */
router.get('/:id/honours', TeamsController.getTeamHonours);

/**
 * GET /api/teams/:id/manager
 * Obtener los datos de la temporada actual (DT, capitán, sitio web).
 */
router.get('/:id/manager', TeamsController.getTeamManager);

module.exports = router;
