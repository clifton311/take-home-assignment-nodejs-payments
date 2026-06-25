import { Router } from 'express';
import { listCommissions, periodSummary } from '../controllers/commission';

export const commissionsRouter = Router();

// GET /commissions/summary  — must be registered before /:id to avoid shadowing
commissionsRouter.get('/summary', periodSummary);

// GET /commissions
commissionsRouter.get('/', listCommissions);
