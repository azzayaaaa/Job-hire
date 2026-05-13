/**
 * Centralized API configuration.
 *
 * In local development the frontend talks directly to each backend service.
 * Set NEXT_PUBLIC_USE_GATEWAY=true if you want to route HTTP calls through
 * the API gateway on port 5000 instead.
 */
const browserOrigin =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}`
    : "http://localhost";

const cleanBase = (value?: string) => value?.replace(/\/$/, "");

const useGateway = process.env.NEXT_PUBLIC_USE_GATEWAY === "true";
const gatewayBase =
  cleanBase(process.env.NEXT_PUBLIC_GATEWAY_URL) || `${browserOrigin}:5000`;

const serviceBase = (port: number, envUrl?: string) =>
  useGateway ? gatewayBase : cleanBase(envUrl) || `${browserOrigin}:${port}`;

const authBase = serviceBase(5001, process.env.NEXT_PUBLIC_AUTH_URL);
const jobBase = serviceBase(5003, process.env.NEXT_PUBLIC_JOB_URL);
const aiBase = serviceBase(5004, process.env.NEXT_PUBLIC_AI_URL);
const userBase = serviceBase(5005, process.env.NEXT_PUBLIC_USER_URL);
const notifyBase = serviceBase(5006, process.env.NEXT_PUBLIC_NOTIFY_URL);
const chatBase = serviceBase(5007, process.env.NEXT_PUBLIC_CHAT_URL);

export const API_URLS = {
  auth: {
    profile: (userId: number | string) =>
      `${authBase}/api/auth/profile/${userId}`,
    updateProfile: () => `${authBase}/api/auth/update-profile`,
    login: () => `${authBase}/api/auth/login`,
    register: () => `${authBase}/api/auth/register`,
    googleLogin: () => `${authBase}/api/auth/google-login`,
    sendCode: () => `${authBase}/api/auth/send-code`,
    verify: () => `${authBase}/api/auth/verify`,
    forgotPassword: () => `${authBase}/api/auth/forgot-password`,
    resetPassword: () => `${authBase}/api/auth/reset-password`,
    adminStats: () => `${authBase}/api/auth/admin/stats`,
    adminUsers: () => `${authBase}/api/auth/admin/users`,
    adminUpdateRole: () => `${authBase}/api/auth/admin/update-role`,
    adminUpdatePlan: () => `${authBase}/api/auth/admin/update-plan`,
    adminDeleteUser: (userId: number | string) =>
      `${authBase}/api/auth/admin/users/${userId}`,
  },

  jobs: {
    all: () => `${jobBase}/api/jobs/all`,
    stats: () => `${jobBase}/api/jobs/filters/stats`,
    apply: () => `${jobBase}/api/jobs/apply`,
    applyWithAutoCv: () => `${jobBase}/api/jobs/apply-with-auto-cv`,
    create: () => `${jobBase}/api/jobs/create`,
    detail: (jobId: number | string) => `${jobBase}/api/jobs/${jobId}`,
    shareLink: (jobId: number | string) => `${jobBase}/api/jobs/${jobId}/share-link`,
    recommendationsForCandidate: () =>
      `${jobBase}/api/jobs/recommendations/for-candidate`,
    recommendationsCandidatesForJob: () =>
      `${jobBase}/api/jobs/recommendations/candidates-for-job`,
    savedCount: (userId: number | string) =>
      `${jobBase}/api/jobs/saved/count/${userId}`,
    save: () => `${jobBase}/api/jobs/save`,
    unsave: (jobId: number | string, userId: number | string) =>
      `${jobBase}/api/jobs/unsave/${jobId}/${userId}`,
    appliedCount: (userId: number | string) =>
      `${jobBase}/api/jobs/applied/count/${userId}`,
    applicationStatus: (applicationId: number | string) =>
      `${jobBase}/api/jobs/applications/${applicationId}/status`,
  },

  chat: {
    conversations: (userId: number | string) =>
      `${chatBase}/api/chat/conversations/${userId}`,
    history: (user1: number | string, user2: number | string) =>
      `${chatBase}/api/chat/history/${user1}/${user2}`,
    send: () => `${chatBase}/api/chat/send`,
    seen: (messageId: number | string) =>
      `${chatBase}/api/chat/messages/${messageId}/seen`,
    reaction: (messageId: number | string) =>
      `${chatBase}/api/chat/messages/${messageId}/reaction`,
    clear: (user1: number | string, user2: number | string) =>
      `${chatBase}/api/chat/clear/${user1}/${user2}`,
  },

  ai: {
    ask: () => `${aiBase}/api/ai/ask`,
    askWithFile: () => `${aiBase}/api/ai/ask-file`,
    parseCv: () => `${aiBase}/api/ai/parse-cv`,
    analyze: () => `${aiBase}/api/ai/analyze`,
    analyzeCv: () => `${aiBase}/api/ai/analyze-cv`,
    matchCvToJob: () => `${aiBase}/api/ai/match-cv-to-job`,
    generateCv: () => `${aiBase}/api/ai/generate-cv`,
    generateRoadmap: () => `${aiBase}/api/ai/generate-roadmap`,
  },

  notify: {
    sendEmail: () => `${notifyBase}/api/notify/send-email`,
  },

  user: {
    profile: (userId: number | string) => `${userBase}/api/users/profile/${userId}`,
    entitlements: (userId: number | string) => `${userBase}/api/users/entitlements/${userId}`,
    useEntitlement: (userId: number | string) => `${userBase}/api/users/entitlements/${userId}/use`,
    upgradePlan: (userId: number | string) => `${userBase}/api/users/entitlements/${userId}/upgrade`,
    createPaymentOrder: () => `${userBase}/api/users/payment-orders`,
    paymentOrders: (userId: number | string) => `${userBase}/api/users/payment-orders/user/${userId}`,
    adminPaymentOrders: () => `${userBase}/api/users/admin/payment-orders`,
    adminApprovePaymentOrder: (orderId: number | string) => `${userBase}/api/users/admin/payment-orders/${orderId}/approve`,
    adminRejectPaymentOrder: (orderId: number | string) => `${userBase}/api/users/admin/payment-orders/${orderId}/reject`,
  },

  notifications: {
    list: (userId: number | string) => `${userBase}/api/notifications/${userId}`,
    unreadCount: (userId: number | string) => `${userBase}/api/notifications/${userId}/unread`,
    create: () => `${userBase}/api/notifications`,
    markAsRead: (notificationId: number | string) => `${userBase}/api/notifications/${notificationId}/read`,
    updatePreferences: (userId: number | string) => `${userBase}/api/notifications/${userId}/preferences`,
    delete: (notificationId: number | string) => `${userBase}/api/notifications/${notificationId}`,
  },

  sockets: {
    chat: () => cleanBase(process.env.NEXT_PUBLIC_CHAT_SOCKET_URL) || chatBase,
    auth: () => cleanBase(process.env.NEXT_PUBLIC_AUTH_SOCKET_URL) || authBase,
  },
} as const;
