"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCandidateStats = exports.getEmployerStats = exports.submitCV = exports.applyForJob = exports.getJobs = exports.createJob = void 0;
const axios_1 = __importDefault(require("axios"));
const JOB_SERVICE_URL = process.env.JOB_SERVICE_URL || 'http://127.0.0.1:5003/api/jobs';
const createJob = async (req, res) => {
    try {
        const response = await axios_1.default.post(`${JOB_SERVICE_URL}/create`, req.body);
        // Emit real-time event to all connected candidates
        const io = req.app.get('io');
        if (io) {
            io.emit('new-job-posted', {
                job: response.data,
                timestamp: new Date()
            });
            console.log('[Auth Service] Emitted new-job-posted event via Socket.io');
        }
        return res.status(201).json(response.data);
    }
    catch (error) {
        console.error("Proxy Create Job Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json(error.response?.data || { error: "Job Service-тэй холбогдож чадсангүй" });
    }
};
exports.createJob = createJob;
const getJobs = async (req, res) => {
    try {
        const response = await axios_1.default.get(`${JOB_SERVICE_URL}/all`);
        return res.status(200).json(response.data);
    }
    catch (error) {
        return res.status(500).json({ error: "Job Service-тэй холбогдож чадсангүй" });
    }
};
exports.getJobs = getJobs;
const applyForJob = async (req, res) => {
    try {
        const response = await axios_1.default.post(`${JOB_SERVICE_URL}/apply`, req.body);
        return res.status(201).json(response.data);
    }
    catch (error) {
        return res.status(500).json({ error: "Job Service-тэй холбогдож чадсангүй" });
    }
};
exports.applyForJob = applyForJob;
const submitCV = async (req, res) => {
    try {
        const response = await axios_1.default.post(`${JOB_SERVICE_URL}/submit-cv`, req.body);
        return res.status(201).json(response.data);
    }
    catch (error) {
        console.error("Submit CV Error:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({ error: "CV илгээхэд алдаа гарлаа" });
    }
};
exports.submitCV = submitCV;
const getEmployerStats = async (req, res) => {
    const { employerId } = req.params;
    try {
        const response = await axios_1.default.get(`${JOB_SERVICE_URL}/stats/employer/${employerId}`);
        return res.status(200).json(response.data);
    }
    catch (error) {
        return res.status(500).json({ error: "Job Service-тэй холбогдож чадсангүй" });
    }
};
exports.getEmployerStats = getEmployerStats;
const getCandidateStats = async (req, res) => {
    const { candidateId } = req.params;
    try {
        const response = await axios_1.default.get(`${JOB_SERVICE_URL}/stats/candidate/${candidateId}`);
        return res.status(200).json(response.data);
    }
    catch (error) {
        return res.status(500).json({ error: "Job Service-тэй холбогдож чадсангүй" });
    }
};
exports.getCandidateStats = getCandidateStats;
