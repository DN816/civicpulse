import React, { useEffect, useState } from 'react';
import { auth } from './config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import CivicPulseLogo from './components/ui/CivicPulseLogo';
import WelcomeScreen from './screens/shared/WelcomeScreen';
import SignInScreen from './screens/shared/SignInScreen';
import CreateAccountScreen from './screens/shared/CreateAccountScreen';
import EmailVerificationScreen from './screens/shared/EmailVerificationScreen';
import RoleRouter from './navigation/RoleRouter';
import { needsEmailVerification } from './utils/authHelpers';

type AppScreen = 'welcome' | 'signin' | 'create-account' | 'router' | 'verify-email';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [user, setUser] = useState<User | null>(null);
  const [isSplashActive, setIsSplashActive] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Splash Screen timer (exactly 1.5 seconds)
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setIsSplashActive(false);
    }, 1500);
    return () => clearTimeout(splashTimer);
  }, []);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
      if (currentUser) {
        if (needsEmailVerification(currentUser)) {
          setScreen('verify-email');
        } else {
          setScreen('router');
        }
      } else {
        // If logged out, only redirect back if on router screen
        setScreen((prev) => (prev === 'router' || prev === 'verify-email' ? 'welcome' : prev));
      }
    });
    return () => unsubscribe();
  }, []);

  // While splash screen is active or auth is checking, show the branded Splash Screen
  if (isSplashActive || isAuthChecking) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-primary text-text-inverse font-sans transition-all duration-500 ease-in-out">
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
          <CivicPulseLogo size="lg" imageClassName="drop-shadow-lg" />
          <h1 className="font-display text-3xl font-bold tracking-tight">CivicPulse</h1>
        </div>
      </div>
    );
  }

  // State-based routing
  switch (screen) {
    case 'welcome':
      return <WelcomeScreen onNavigate={setScreen} />;
    case 'signin':
      return <SignInScreen onNavigate={setScreen} />;
    case 'create-account':
      return <CreateAccountScreen onNavigate={setScreen} />;
    case 'verify-email':
      return <EmailVerificationScreen onNavigate={setScreen} />;
    case 'router':
      return <RoleRouter onNavigate={setScreen} />;
    default:
      return <WelcomeScreen onNavigate={setScreen} />;
  }
}
