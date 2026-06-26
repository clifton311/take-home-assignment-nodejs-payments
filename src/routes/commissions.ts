import { Router } from 'express';
import { listCommissions, periodSummary } from '../controllers/commission';

export const commissionsRouter = Router();

// GET /commissions/summary 
commissionsRouter.get('/summary', periodSummary);

// GET /commissions
commissionsRouter.get('/', listCommissions);
