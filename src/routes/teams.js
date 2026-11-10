const express = require('express');
const router = express.Router();
const TeamsController = require('../controllers/teams.controller');

/**
 * 1. Todos los equipos de la temporada (con filtro opcional ?city=Londres)
 *    GET /api/teams
 *    GET /api/teams?city=Londres
 */
router.get('/', TeamsController.getAllTeams);

/**
 * 2. Filtrar equipos directamente por ciudad en la URL
 *    GET /api/teams/city/Londres
 */
router.get('/city/:city', TeamsController.getTeamsByCity);

/**
 * 3. Detalle completo de un equipo a partir de su ID numérico o código TLA
 *    GET /api/teams/1
 *    GET /api/teams/ARS
 */
router.get('/:id', TeamsController.getTeamById);


/**
 * 4. Estadio de un equipo
 *    GET /api/teams/1/stadium  o  GET /api/teams/ARS/stadium
 */
router.get('/:id/stadium', TeamsController.getTeamStadium);

/**
 * 5. Palmarés de trofeos de un equipo
 *    GET /api/teams/1/honours  o  GET /api/teams/ARS/honours
 */
router.get('/:id/honours', TeamsController.getTeamHonours);

/**
 * 6. Masa social y apodo de un equipo
 *    GET /api/teams/1/members  o  GET /api/teams/ARS/members
 */
router.get('/:id/members', TeamsController.getTeamMembers);

/**
 * 7. Información de la temporada actual (DT, capitán, sitio web)
 *    GET /api/teams/1/season   o  GET /api/teams/ARS/season
 *    GET /api/teams/1/manager  o  GET /api/teams/ARS/manager
 */
router.get('/:id/season', TeamsController.getTeamManager);
router.get('/:id/manager', TeamsController.getTeamManager);

// ── Operaciones de modificación (CRUD) ─────────────────────────────────────────

/**
 * 8. Crear un nuevo equipo
 *    POST /api/teams
 */
router.post('/', TeamsController.createTeam);

/**
 * 9. Actualizar un equipo existente
 *    PUT /api/teams/:id
 */
router.put('/:id', TeamsController.updateTeam);

/**
 * 10. Eliminar un equipo
 *     DELETE /api/teams/:id
 */
router.delete('/:id', TeamsController.deleteTeam);

module.exports = router;
