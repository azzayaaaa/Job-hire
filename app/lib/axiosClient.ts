import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import type { Session } from 'next-auth';

type SessionWithToken = Session & {
  user?: Session['user'] & {
    accessToken?: string;
  };
};

/**
 * Authenticated Axios instance with JWT token interceptor
 * Automatically injects Authorization header from NextAuth session
 */
let axiosInstance: AxiosInstance | null = null;
let sessionCache: { value: Session | null; expiresAt: number } | null = null;
let sessionPromise: Promise<Session | null> | null = null;

const isNetworkError = (error: any) =>
  error?.code === 'ERR_NETWORK' ||
  error?.message === 'Network Error' ||
  error?.code === 'ECONNREFUSED' ||
  error?.code === 'ETIMEDOUT';

const isRelativeNextApiUrl = (url: string) => url.startsWith('/api/');

const getCachedSession = async (): Promise<Session | null> => {
  const now = Date.now();
  if (sessionCache && sessionCache.expiresAt > now) {
    return sessionCache.value;
  }

  if (!sessionPromise) {
    sessionPromise = getSession()
      .then((session) => {
        sessionCache = { value: session, expiresAt: Date.now() + 60_000 };
        return session;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }

  return sessionPromise;
};

export const getAxiosClient = (): AxiosInstance => {
  if (axiosInstance) {
    return axiosInstance;
  }

  axiosInstance = axios.create({
    timeout: 60000,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: Add Authorization header
  axiosInstance.interceptors.request.use(
    async (config) => {
      try {
        // Use a timeout for getSession to prevent hanging requests
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timeout')), 3000)
        );
        
        const session = (await Promise.race([getCachedSession(), timeoutPromise])) as SessionWithToken | null;
        if (session?.user) {
          const accessToken = session.user.accessToken;
          if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
          }
        }
      } catch (error) {
        console.debug('Note: Could not get session for auth header (continuing without it):', 
          error instanceof Error ? error.message : 'unknown');
        // Don't fail the request if session is unavailable
      }
      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor: Handle 401 errors and log other failures
  axiosInstance.interceptors.response.use(
    (response) => {
      // Log successful responses for debugging (optional)
      return response;
    },
    async (error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      const status = error.response?.status;
      const requestUrl = String(error.config?.url || "");
      const isOptionalChatPoll =
        status === 504 && requestUrl.includes("/api/chat/conversations/");

      // Log different error types
      if (isOptionalChatPoll) {
        console.debug("Chat service unavailable; conversations will retry later.");
      } else if (status === 402) {
        // 402 is expected when hitting free tier limits - not an error
        console.debug('Payment required (402): User has hit free tier limit');
      } else if (status === 401) {
        console.warn('Unauthorized (401): Session may have expired');
      } else if (errorCode === 'ECONNABORTED') {
        console.warn(`Request timeout calling ${requestUrl}. Retrying if possible.`);
      } else if (isNetworkError(error)) {
        if (isRelativeNextApiUrl(requestUrl)) {
          console.debug(`Transient network error calling ${requestUrl}; retrying if possible.`);
        } else {
          console.warn(`Network error calling ${requestUrl}:`, errorMessage);
        }
      } else if (status) {
        // Server responded with an error status
        console.error(`Server error ${status} calling ${requestUrl}:`, error.response?.data);
      } else if (error.request) {
        // Request was made but no response received
        console.error(`No response from server at ${requestUrl} - check connectivity`);
      } else if (error.config) {
        // Error in request configuration
        console.error(`Request configuration error for ${requestUrl}:`, errorMessage);
      } else {
        console.error(`Unknown error calling ${requestUrl}:`, errorMessage);
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
};

/**
 * Retry failed requests with exponential backoff for network errors
 */
const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxRetries: number = 2,
  initialDelayMs: number = 500
): Promise<any> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on network errors, not on server errors
      if (!isNetworkError(error) || attempt === maxRetries) {
        throw error;
      }
      
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.debug(`Network error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
};

/**
 * Make authenticated API call with automatic retry for network errors
 * Usage: await authenticatedFetch(`/api/auth/profile/${userId}`)
 */
export const authenticatedFetch = async (
  url: string,
  config?: AxiosRequestConfig
) => {
  return retryWithBackoff(() => {
    const client = getAxiosClient();
    return client.get(url, config);
  });
};

/**
 * Make authenticated POST request with automatic retry for network errors
 */
export const authenticatedPost = async (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
) => {
  return retryWithBackoff(() => {
    const client = getAxiosClient();
    return client.post(url, data, config);
  });
};

/**
 * Make authenticated PUT request with automatic retry for network errors
 */
export const authenticatedPut = async (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
) => {
  return retryWithBackoff(() => {
    const client = getAxiosClient();
    return client.put(url, data, config);
  });
};

/**
 * Make authenticated PATCH request with automatic retry for network errors
 */
export const authenticatedPatch = async (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
) => {
  return retryWithBackoff(() => {
    const client = getAxiosClient();
    return client.patch(url, data, config);
  });
};

/**
 * Make authenticated DELETE request with automatic retry for network errors
 */
export const authenticatedDelete = async (
  url: string,
  config?: AxiosRequestConfig
) => {
  return retryWithBackoff(() => {
    const client = getAxiosClient();
    return client.delete(url, config);
  });
};

// Reset instance when session changes (for logout)
export const resetAxiosClient = () => {
  axiosInstance = null;
  sessionCache = null;
  sessionPromise = null;
};
