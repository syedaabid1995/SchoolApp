import { Router } from 'express';
import { resolvePublicSchoolDomain } from '../controllers/schoolDomain.controller';

export const schoolDomainRouter = Router();

schoolDomainRouter.get('/', resolvePublicSchoolDomain);
