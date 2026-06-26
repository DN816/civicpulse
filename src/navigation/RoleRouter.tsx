import React, { useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { UserRole } from '../types';

// Import screens
import CitizenRouter from '../screens/citizen/CitizenRouter';
import AuthorityDashboardScreen from '../screens/authority/AuthorityDashboardScreen';
import ModeratorQueueScreen from '../screens/moderator/ModeratorQueueScreen';
import ErrorScreen from '../screens/shared/ErrorScreen';

interface RoleRouterProps {
  onNavigate: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

export default function RoleRouter({ onNavigate }: RoleRouterProps) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getRole = async () => {
    const user = auth.currentUser;
    if (!user) {
      onNavigate('welcome');
      return;
    }

    // Redirect unverified email/password users to verification screen
    // Google sign-in users are always considered verified
    if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
      onNavigate('verify-email');
      return;
    }

    try {
      // Force token refresh to get latest Custom Claims
      const tokenResult = await user.getIdTokenResult(true);
      const claimedRole = tokenResult.claims.role as UserRole | undefined;

      if (claimedRole) {
        setRole(claimedRole);
        setIsLoading(false);
      } else {
        // Fallback to 'citizen' as default role
        setRole('citizen');
        setIsLoading(false);
      }
    } catch (e) {
      console.error('Error fetching role claim:', e);
      setRole('citizen');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getRole();
  }, []);

  const handleSignOut = async () => {
    await auth.signOut();
    onNavigate('welcome');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 text-white font-sans gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-blue-500" />
        <p className="text-zinc-400 text-sm font-medium animate-pulse">
          Authenticating & loading dashboard...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorScreen 
        message="Account setup incomplete or role not assigned. Please contact support." 
        onSignOut={handleSignOut}
      />
    );
  }

  if (role === 'citizen') return <CitizenRouter onNavigateOut={onNavigate} />;
  if (role === 'authority') return <AuthorityDashboardScreen />;
  if (role === 'moderator') return <ModeratorQueueScreen />;

  return (
    <ErrorScreen 
      message="Unknown role or claim mapping error. Please contact support." 
      onSignOut={handleSignOut}
    />
  );
}
