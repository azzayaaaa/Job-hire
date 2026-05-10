/**
 * Centralized API configuration
 * All backend service URLs are defined here for consistency
 *
 * IMPORTANT:
 * For browser use (Next.js client components), avoid hardcoding `localhost:500x`
 * because when the frontend is accessed from another device, `localhost` points
 * to that other device—not your backend.
 *
 * We route all calls through the API gateway (port 5000) and keep the same paths:
 *   /api/auth, /api/jobs, /api/ai, /api/notify, /api/users, /api/chat
 */
const gatewayBase =
  process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "") ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000");

export const API_URLS = {
  // Auth Service (proxied by gateway /api/auth -> 5001)
  auth: {
    profile: (userId: number | string) =>
      `${gatewayBase}/api/auth/profile/${userId}`,
    updateProfile: () => `${gatewayBase}/api/auth/update-profile`,
    login: () => `${gatewayBase}/api/auth/login`,
    register: () => `${gatewayBase}/api/auth/register`,
    googleLogin: () => `${gatewayBase}/api/auth/google-login`,
    sendCode: () => `${gatewayBase}/api/auth/send-code`,
    verify: () => `${gatewayBase}/api/auth/verify`,
    forgotPassword: () => `${gatewayBase}/api/auth/forgot-password`,
    resetPassword: () => `${gatewayBase}/api/auth/reset-password`,
  },

  // Job Service (proxied by gateway /api/jobs -> 5003)
  jobs: {
    all: () => `${gatewayBase}/api/jobs/all`,
    stats: () => `${gatewayBase}/api/jobs/filters/stats`,
    apply: () => `${gatewayBase}/api/jobs/apply`,
    create: () => `${gatewayBase}/api/jobs/create`,
    detail: (jobId: number | string) => `${gatewayBase}/api/jobs/${jobId}`,
    savedCount: (userId: number | string) =>
      `${gatewayBase}/api/jobs/saved/count/${userId}`,
    save: () => `${gatewayBase}/api/jobs/save`,
    unsave: (jobId: number | string, userId: number | string) =>
      `${gatewayBase}/api/jobs/unsave/${jobId}/${userId}`,
    appliedCount: (userId: number | string) =>
      `${gatewayBase}/api/jobs/applied/count/${userId}`,
    applicationStatus: (applicationId: number | string) =>
      `${gatewayBase}/api/jobs/applications/${applicationId}/status`,
  },

  // Chat Service (proxied by gateway /api/chat -> 5007)
  chat: {
    conversations: (userId: number | string) =>
      `${gatewayBase}/api/chat/conversations/${userId}`,
    history: (user1: number | string, user2: number | string) =>
      `${gatewayBase}/api/chat/history/${user1}/${user2}`,
    send: () => `${gatewayBase}/api/chat/send`,
    clear: (user1: number | string, user2: number | string) =>
      `${gatewayBase}/api/chat/clear/${user1}/${user2}`,
  },

  // AI Service (proxied by gateway /api/ai -> 5004)
  ai: {
    ask: () => `${gatewayBase}/api/ai/ask`,
    askWithFile: () => `${gatewayBase}/api/ai/ask-file`,
    parseCv: () => `${gatewayBase}/api/ai/parse-cv`,
    analyze: () => `${gatewayBase}/api/ai/analyze`,
    generateCv: () => `${gatewayBase}/api/ai/generate-cv`,
  },

  // Notify Service (proxied by gateway /api/notify -> 5006)
  notify: {
    sendEmail: () => `${gatewayBase}/api/notify/send-email`,
  },

  // User Service (proxied by gateway /api/users -> 5005)
  user: {
    profile: (userId: number | string) => `${gatewayBase}/api/users/profile/${userId}`,
  },

  // Notifications (proxied by gateway /api/notifications -> 5005)
  notifications: {
    list: (userId: number | string) => `${gatewayBase}/api/notifications/${userId}`,
    unreadCount: (userId: number | string) => `${gatewayBase}/api/notifications/${userId}/unread`,
    create: () => `${gatewayBase}/api/notifications`,
    markAsRead: (notificationId: number | string) => `${gatewayBase}/api/notifications/${notificationId}/read`,
    updatePreferences: (userId: number | string) => `${gatewayBase}/api/notifications/${userId}/preferences`,
    delete: (notificationId: number | string) => `${gatewayBase}/api/notifications/${notificationId}`,
  },

  // WebSocket endpoints
  // Note: gateway currently proxies HTTP only; if you need websockets, point these
  // directly at your chat/auth websocket servers.
  sockets: {
    chat: () => `http://localhost:5007`,
    auth: () => `http://localhost:5001`,
  },
} as const;
