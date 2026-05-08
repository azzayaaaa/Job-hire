"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ai_controller_1 = require("../controllers/ai.controller"); // Нэрийг нь шалга
const router = express_1.default.Router();
// Хэрэв askAi эсвэл generateAiCV нь undefined байвал энэ алдаа гарна
router.post('/ask', ai_controller_1.askAi);
router.post('/generate-cv', ai_controller_1.generateAiCV);
router.post('/study-plan', ai_controller_1.getStudyPlan);
router.get('/market-insights', ai_controller_1.getMarketInsights);
exports.default = router;
