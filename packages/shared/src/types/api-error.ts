/** An error for one field of the request body (= one form field). */
export interface ApiFieldError {
  /** Name of the field in the request body, e.g. `username`. */
  field: string;
  /** Already translated by the backend. */
  message: string;
}

/** Body of every error response from the API (our endpoints and Better Auth's). */
export interface ApiError {
  /** Stable code for programs, e.g. `USERNAME_IS_ALREADY_TAKEN`. */
  code: string;
  /** Already translated by the backend. Shown when there are no field errors. */
  message: string;
  fieldErrors?: ApiFieldError[];
}
