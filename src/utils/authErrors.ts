interface FirebaseAuthError {
  code?: string;
  message?: string;
}

export const INVALID_EMAIL_PASSWORD_MESSAGE = 'Invalid email or password.';

export function getAuthErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as FirebaseAuthError).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function getAuthErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as FirebaseAuthError).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

/** Generic messages for email/password sign-in — never reveal account existence or provider. */
export function getEmailPasswordSignInErrorMessage(
  code: string | undefined,
  fallback = 'Unable to sign in. Please try again.'
): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/account-exists-with-different-credential':
    case 'auth/invalid-email':
      return INVALID_EMAIL_PASSWORD_MESSAGE;
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for help.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not available right now. Please try again later.';
    default:
      return fallback;
  }
}

/** Messages for the Google sign-in button — separate from email/password form errors. */
export function getGoogleSignInErrorMessage(
  code: string | undefined,
  fallback = 'Unable to sign in. Please try again.'
): string {
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is not enabled in your Firebase console.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return fallback;
  }
}

/** Generic messages for email/password account creation. */
export function getEmailPasswordCreateErrorMessage(
  code: string | undefined,
  fallback = 'Unable to create account. Please try again.'
): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Unable to create an account with this email. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-up is not available right now. Please try again later.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return fallback;
  }
}
