import axios, { AxiosError } from 'axios';
import { toApiError } from './dto';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL,
  headers: { Accept: 'application/json' },
  timeout: 15000,
  // The auth cookie is HttpOnly and set on the API's own origin
  // (localhost:8000), while every caller -- host and each microfrontend -- is
  // a different origin. Without this flag the browser strips the cookie from
  // every cross-origin request regardless of what the server's CORS headers
  // allow; this is the axios-side half of that contract, matching
  // supports_credentials in the backend's config/cors.php.
  withCredentials: true,
});

/**
 * Single place where every API failure becomes an ApiError.
 * Components never see raw axios errors.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0;
    const apiError = toApiError(status, error.response?.data);

    // The cookie died server-side (expired, or the server restarted with a
    // rotated secret) -- drop the cached session so RequireAuth bounces to
    // login instead of showing a UI for a user that no longer has one.
    if (status === 401) {
      queryClient.setQueryData(queryKeys.session(), null);
    }

    return Promise.reject(apiError);
  },
);
