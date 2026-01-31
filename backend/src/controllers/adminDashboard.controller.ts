import type { Request, Response } from 'express';
import { resolveSchoolId } from '../utils/tenant';
import { getAdminDashboardMetrics } from '../services/adminDashboard.service';

export const getAdminDashboardApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const metrics = await getAdminDashboardMetrics(schoolId);
  res.status(200).json(metrics);
};
