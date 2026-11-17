import { ApiError } from "../../shared/api";

export type AuthFieldErrors = Partial<Record<string, string>>;

export function apiFieldErrors(error: unknown): AuthFieldErrors {
  return error instanceof ApiError
    ? Object.fromEntries(
        error.errors?.map(({ field, message }) => [field, message]) ?? [],
      )
    : {};
}

export function fieldErrorProps(message: string | undefined, errorId: string) {
  return {
    "aria-invalid": message ? true : undefined,
    "aria-describedby": message ? errorId : undefined,
  };
}

export function emailError(value: string, field: HTMLInputElement) {
  if (!value.trim()) return "Vui lòng nhập email.";
  if (field.validity.typeMismatch) return "Vui lòng nhập địa chỉ email hợp lệ.";
}

export function focusFirstError(
  form: HTMLFormElement,
  errors: AuthFieldErrors,
) {
  for (const field of form.elements) {
    if (
      (field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement) &&
      errors[field.name]
    ) {
      field.focus();
      return;
    }
  }
}
