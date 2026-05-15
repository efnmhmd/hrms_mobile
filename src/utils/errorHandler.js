export const isNetworkError = (error) => !error?.response && !!error?.request;

export const isServerError = (error) => error?.response?.status >= 500;

export const isClientError = (error) =>
  error?.response?.status >= 400 && error?.response?.status < 500;

export const getErrorMessage = (error) => {
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection.';
  }
  if (isServerError(error)) {
    return 'Server error. Please try again later.';
  }
  if (isClientError(error)) {
    return error?.response?.data?.message || 'Invalid request.';
  }
  return error?.response?.data?.message || error?.message || 'An unexpected error occurred.';
};
