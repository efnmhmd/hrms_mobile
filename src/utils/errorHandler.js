export const isNetworkError = (error) => !error?.response && !!error?.request;

export const isServerError = (error) => error?.response?.status >= 500;

export const isClientError = (error) =>
  error?.response?.status >= 400 && error?.response?.status < 500;

// Backends in this stack don't always put the human-readable text on `message`.
// Pull from the common alternatives so a real cause surfaces instead of a
// generic "Invalid request." Handles: { message }, { error }, { errors: {...} }
// (Mongoose-style validation maps), arrays, and plain-string/HTML bodies.
const extractServerMessage = (data) => {
  if (!data) return null;
  if (typeof data === 'string') {
    // Ignore HTML error pages (e.g. proxy 400/404) — not user-friendly.
    return /<\s*html/i.test(data) ? null : data;
  }
  if (data.message) return data.message;
  if (typeof data.error === 'string') return data.error;
  if (data.error?.message) return data.error.message;
  if (data.errors) {
    if (Array.isArray(data.errors)) {
      const parts = data.errors.map((e) => e?.message || e?.msg || e).filter(Boolean);
      if (parts.length) return parts.join(', ');
    } else if (typeof data.errors === 'object') {
      // Mongoose ValidationError shape: { errors: { field: { message } } }
      const parts = Object.values(data.errors).map((e) => e?.message || e).filter(Boolean);
      if (parts.length) return parts.join(', ');
    }
  }
  return null;
};

export const getErrorMessage = (error) => {
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection.';
  }
  const serverMsg = extractServerMessage(error?.response?.data);
  if (isServerError(error)) {
    return serverMsg || 'Server error. Please try again later.';
  }
  if (isClientError(error)) {
    return serverMsg || `Request rejected (${error.response.status}).`;
  }
  return serverMsg || error?.message || 'An unexpected error occurred.';
};
