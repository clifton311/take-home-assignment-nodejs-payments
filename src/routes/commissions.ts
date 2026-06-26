import { Router } from 'express';
import { listCommissions, periodSummary, statusSummary, partyTypeSummary } from '../controllers/commission';

export const commissionsRouter = Router();

commissionsRouter.get('/summary/by-status', statusSummary);
commissionsRouter.get('/summary/by-party-type', partyTypeSummary);
commissionsRouter.get('/summary', periodSummary);
commissionsRouter.get('/', listCommissions);
