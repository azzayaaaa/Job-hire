"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const router = (0, express_1.Router)();
router.post('/send-code', auth_controller_1.sendCode);
router.post('/verify', auth_controller_1.verifyCode);
router.post('/register', auth_controller_1.register);
exports.default = router;
