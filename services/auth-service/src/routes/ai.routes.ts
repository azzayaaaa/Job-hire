import express from 'express';
import { askAi, generateAiCV, getStudyPlan, getMarketInsights } from '../controllers/ai.controller'; // Нэрийг нь шалга

const router = express.Router();

// Хэрэв askAi эсвэл generateAiCV нь undefined байвал энэ алдаа гарна
router.post('/ask', askAi);
router.post('/generate-cv', generateAiCV);
router.post('/study-plan', getStudyPlan);
router.get('/market-insights', getMarketInsights);

export default router;