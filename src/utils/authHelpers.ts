import type { User } from 'firebase/auth';

export function hasPasswordProvider(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'password');
}

/** Email/password accounts must verify before accessing the app. */
export function needsEmailVerification(user: User): boolean {
  return !user.emailVerified && hasPasswordProvider(user);
}

export function trimEmail(email: string): string {
  return email.trim().toLowerCase();
}
