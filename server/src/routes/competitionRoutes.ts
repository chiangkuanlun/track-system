import express from 'express';
import multer from 'multer';
import {
  getCompetitions, getCompetitionById, createCompetition, deleteCompetition,
  updateCompetition, importAthletes, getCurrentCompetition, getGroups, updateGroup,
  getEvents, getEvent, createEvent, updateEvent, deleteEvent, getAthletes,
  createAthlete, updateAthlete, deleteAthlete, initializeHeats, saveHeats,
  getRecentEvents, arrangeNextRound, resetEventResults, autoAssignPersonnel
} from '../controllers/competitionController';
import { protect, admin, groupAccess } from '../middleware/authMiddleware';

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const valid = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (!valid) {
      callback(new Error('只接受 Excel 或 CSV 檔案'));
      return;
    }
    callback(null, true);
  }
});
const router = express.Router();

router.use(protect);

router.get('/', getCompetitions);
router.get('/current', getCurrentCompetition);
router.get('/events/recent-results', getRecentEvents);
router.get('/:id', getCompetitionById);
router.post('/', admin, createCompetition);
router.put('/:id', admin, updateCompetition);
router.delete('/:id', admin, deleteCompetition);
router.post('/:id/import', admin, upload.single('file'), importAthletes);
router.post('/:id/auto-assign', admin, autoAssignPersonnel);

router.get('/:competitionId/groups', getGroups);
router.put('/groups/:id', admin, updateGroup);

router.get('/groups/:groupId/events', groupAccess('group'), getEvents);
router.get('/events/:id', groupAccess('event'), getEvent);
router.post('/events', admin, createEvent);
router.put('/events/:id', admin, updateEvent);
router.delete('/events/:id', admin, deleteEvent);
router.post('/events/:eventId/initialize-heats', groupAccess('event'), initializeHeats);
router.post('/events/:eventId/save-heats', groupAccess('event'), saveHeats);
router.post('/events/:eventId/arrange-next', groupAccess('event'), arrangeNextRound);
router.post('/events/:eventId/reset', groupAccess('event'), resetEventResults);

router.get('/events/:eventId/athletes', groupAccess('event'), getAthletes);
router.post('/athletes', groupAccess('athlete'), createAthlete);
router.put('/athletes/:id', groupAccess('athlete'), updateAthlete);
router.delete('/athletes/:id', groupAccess('athlete'), deleteAthlete);

export default router;
