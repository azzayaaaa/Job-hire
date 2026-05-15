const browserOrigin =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}`
    : "http://localhost";

const apiBase = "";

export const API_URLS = {
  auth: {
    profile: (userId: number | string) =>
      `${apiBase}/api/auth/profile/${userId}`,
    updateProfile: () => `${apiBase}/api/auth/update-profile`,
    login: () => `${apiBase}/api/auth/login`,
    register: () => `${apiBase}/api/auth/register`,
    googleLogin: () => `${apiBase}/api/auth/google-login`,
    sendCode: () => `${apiBase}/api/auth/send-code`,
    verify: () => `${apiBase}/api/auth/verify`,
    forgotPassword: () => `${apiBase}/api/auth/forgot-password`,
    resetPassword: () => `${apiBase}/api/auth/reset-password`,
    adminStats: () => `${apiBase}/api/auth/admin/stats`,
    adminUsers: () => `${apiBase}/api/auth/admin/users`,
    adminUpdateRole: () => `${apiBase}/api/auth/admin/update-role`,
    adminUpdatePlan: () => `${apiBase}/api/auth/admin/update-plan`,
    adminDeleteUser: (userId: number | string) => `${apiBase}/api/auth/admin/users/${userId}`,
  },

  jobs: {
    all: () => `${apiBase}/api/jobs/all`,
    stats: () => `${apiBase}/api/jobs/filters/stats`,
    apply: () => `${apiBase}/api/jobs/apply`,
    applyWithAutoCv: () => `${apiBase}/api/jobs/apply-with-auto-cv`,
    create: () => `${apiBase}/api/jobs/create`,
    detail: (jobId: number | string) => `${apiBase}/api/jobs/${jobId}`,
    employerJobs: (employerId: number | string) => `${apiBase}/api/jobs/employer/${employerId}`,
    update: (jobId: number | string) => `${apiBase}/api/jobs/${jobId}`,
    updateStatus: (jobId: number | string) => `${apiBase}/api/jobs/${jobId}/status`,
    delete: (jobId: number | string) => `${apiBase}/api/jobs/${jobId}`,
    shareLink: (jobId: number | string) => `${apiBase}/api/jobs/${jobId}/share-link`,
    recommendationsForCandidate: () =>
      `${apiBase}/api/jobs/recommendations/for-candidate`,
    recommendationsCandidatesForJob: () =>
      `${apiBase}/api/jobs/recommendations/candidates-for-job`,
    savedCount: (userId: number | string) =>
      `${apiBase}/api/jobs/saved/count/${userId}`,
    save: () => `${apiBase}/api/jobs/save`,
    unsave: (jobId: number | string, userId: number | string) =>
      `${apiBase}/api/jobs/unsave/${jobId}/${userId}`,
    appliedCount: (userId: number | string) =>
      `${apiBase}/api/jobs/applied/count/${userId}`,
    applicationStatus: (applicationId: number | string) =>
      `${apiBase}/api/jobs/applications/${applicationId}/status`,
  },

  chat: {
    conversations: (userId: number | string) =>
      `${apiBase}/api/chat/conversations/${userId}`,
    history: (user1: number | string, user2: number | string) =>
      `${apiBase}/api/chat/history/${user1}/${user2}`,
    send: () => `${apiBase}/api/chat/send`,
    seen: (messageId: number | string) =>
      `${apiBase}/api/chat/messages/${messageId}/seen`,
    reaction: (messageId: number | string) =>
      `${apiBase}/api/chat/messages/${messageId}/reaction`,
    clear: (user1: number | string, user2: number | string) =>
      `${apiBase}/api/chat/clear/${user1}/${user2}`,
  },

  ai: {
    ask: () => `${apiBase}/api/ai/ask`,
    askWithFile: () => `${apiBase}/api/ai/ask-file`,
    parseCv: () => `${apiBase}/api/ai/parse-cv`,
    analyze: () => `${apiBase}/api/ai/analyze`,
    analyzeCv: () => `${apiBase}/api/ai/analyze-cv`,
    matchCvToJob: () => `${apiBase}/api/ai/match-cv-to-job`,
    generateCv: () => `${apiBase}/api/ai/generate-cv`,
    generateRoadmap: () => `${apiBase}/api/ai/generate-roadmap`,
  },

  notify: {
    sendEmail: () => `${apiBase}/api/notify/send-email`,
  },

  user: {
    profile: (userId: number | string) => `${apiBase}/api/users/profile/${userId}`,
    entitlements: (userId: number | string) => `${apiBase}/api/users/entitlements/${userId}`,
    useEntitlement: (userId: number | string) => `${apiBase}/api/users/entitlements/${userId}/use`,
    upgradePlan: (userId: number | string) => `${apiBase}/api/users/entitlements/${userId}/upgrade`,
    createPaymentOrder: () => `${apiBase}/api/users/payment-orders`,
    paymentOrders: (userId: number | string) => `${apiBase}/api/users/payment-orders/user/${userId}`,
    adminPaymentOrders: () => `${apiBase}/api/users/admin/payment-orders`,
    adminApprovePaymentOrder: (orderId: number | string) => `${apiBase}/api/users/admin/payment-orders/${orderId}/approve`,
    adminRejectPaymentOrder: (orderId: number | string) => `${apiBase}/api/users/admin/payment-orders/${orderId}/reject`,
  },

  notifications: {
    list: (userId: number | string) => `${apiBase}/api/notifications/${userId}`,
    unreadCount: (userId: number | string) => `${apiBase}/api/notifications/${userId}/unread`,
    create: () => `${apiBase}/api/notifications`,
    markAsRead: (notificationId: number | string) => `${apiBase}/api/notifications/${notificationId}/read`,
    updatePreferences: (userId: number | string) => `${apiBase}/api/notifications/${userId}/preferences`,
    delete: (notificationId: number | string) => `${apiBase}/api/notifications/${notificationId}`,
  },

  sockets: {
    chat: () => browserOrigin,
    auth: () => browserOrigin,
  },
} as const;
