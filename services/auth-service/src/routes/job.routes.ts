import { Router } from 'express';
import { createJob, getJobs, applyForJob, submitCV, getEmployerStats, getCandidateStats } from '../controllers/job.controller';

const router = Router();

router.post('/create', createJob);
router.get('/all', getJobs);
router.post('/apply', applyForJob);
router.post('/submit-cv', submitCV);
router.get('/stats/employer/:employerId', getEmployerStats);
router.get('/stats/candidate/:candidateId', getCandidateStats);

export default router;
