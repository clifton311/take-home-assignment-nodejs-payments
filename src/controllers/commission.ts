import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { findCommissions, getPeriodSummary } from '../models/commission.model';
import { parseCommissionListParams, parsePeriodSummaryParams } from '../utils/parseParams';
import { logger } from '../logger';


// Requerst handlers for commission-related endpoints
export async function listCommissions(req: Request, res: Response): Promise<void> {
  // console.log({ query: req.query }, 'listCommissions called');
  const parsed = parseCommissionListParams(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    res.status(400).json({ code: 'INVALID_PARAMS', message: parsed.error });
    return;
  }

  try {
    const result = await findCommissions(pool, parsed.value);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'listCommissions error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
}

export async function periodSummary(req: Request, res: Response): Promise<void> {
  const parsed = parsePeriodSummaryParams(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    res.status(400).json({ code: 'INVALID_PARAMS', message: parsed.error });
    return;
  }

  try {
    const result = await getPeriodSummary(pool, parsed.value);
    res.status(200).json(result);
  } catch (err) {
    logger.error({ err }, 'periodSummary error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
}
