import { Request, Response } from 'express';
import axios from 'axios';

const JOB_SERVICE_URL = process.env.JOB_SERVICE_URL || 'http://127.0.0.1:5003/api/jobs';

export const createJob = async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${JOB_SERVICE_URL}/create`, req.body);
    
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
  } catch (error: any) {
    console.error("Proxy Create Job Error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(error.response?.data || { error: "Job Service-тэй холбогдож чадсангүй" });
  }
};

export const getJobs = async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${JOB_SERVICE_URL}/all`);
    return res.status(200).json(response.data);
  } catch (error: any) {
    return res.status(500).json({ error: "Job Service-тэй холбогдож чадсангүй" });
  }
};

export const applyForJob = async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${JOB_SERVICE_URL}/apply`, req.body);
    return res.status(201).json(response.data);
  } catch (error: any) {
    return res.status(500).json({ error: "Job Service-тэй холбогдож чадсангүй" });
  }
};

export const submitCV = async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${JOB_SERVICE_URL}/submit-cv`, req.body);
    return res.status(201).json(response.data);
  } catch (error: any) {
    console.error("Submit CV Error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ error: "CV илгээхэд алдаа гарлаа" });
  }
};

export const getEmployerStats = async (req: Request, res: Response) => {
  const { employerId } = req.params;
  try {
    const response = await axios.get(`${JOB_SERVICE_URL}/stats/employer/${employerId}`);
    return res.status(200).json(response.data);
  } catch (error: any) {
    return res.status(500).json({ error: "Job Service-тэй холбогдож чадсангүй" });
  }
};

export const getCandidateStats = async (req: Request, res: Response) => {
  const { candidateId } = req.params;
  try {
    const response = await axios.get(`${JOB_SERVICE_URL}/stats/candidate/${candidateId}`);
    return res.status(200).json(response.data);
  } catch (error: any) {
    return res.status(500).json({ error: "Job Service-тэй холбогдож чадсангүй" });
  }
};
