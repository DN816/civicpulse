import React, { useEffect, useState, Suspense } from 'react';
import { auth } from '../config/firebase';
import { UserRole } from '../types';
import ErrorScreen from '../screens/shared/ErrorScreen';
import { needsEmailVerification } from '../utils/authHelpers';

const CitizenRouter = React.lazy(() => import('../screens/citizen/CitizenRouter'));
const AuthorityRouter = React.lazy(() => import('../screens/authority/AuthorityRouter'));
const ModeratorRouter = React.lazy(() => import('../screens/moderator/ModeratorRouter'));

interface RoleRouterProps {
  onNavigate: (screen: 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email') => void;
}

function RouterFallback() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 text-white font-sans gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-blue-500" />
      <p className="text-zinc-400 text-sm font-medium animate-pulse">
        Loading dashboard...
      </p>
    </div>
  );
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

    if (needsEmailVerification(user)) {
      onNavigate('verify-email');
      return;
    }

    try {
      let claimedRole: UserRole | undefined;

      // Custom claims are set by CF0 on signup — retry briefly if not yet propagated
      for (let attempt = 0; attempt < 6; attempt++) {
        const tokenResult = await user.getIdTokenResult(attempt > 0);
        claimedRole = tokenResult.claims.role as UserRole | undefined;
        if (claimedRole) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (claimedRole) {
        setRole(claimedRole);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
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

  return (
    <Suspense fallback={<RouterFallback />}>
      {role === 'citizen' && <CitizenRouter onNavigateOut={onNavigate} />}
      {role === 'authority' && <AuthorityRouter onNavigateOut={onNavigate} />}
      {role === 'moderator' && <ModeratorRouter onNavigateOut={onNavigate} />}
    </Suspense>
  );
}
