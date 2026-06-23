import React, { useEffect, useState } from 'react';
import { auth } from './config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Shield } from 'lucide-react';
import WelcomeScreen from './screens/shared/WelcomeScreen';
import SignInScreen from './screens/shared/SignInScreen';
import CreateAccountScreen from './screens/shared/CreateAccountScreen';
import RoleRouter from './navigation/RoleRouter';

type AppScreen = 'welcome' | 'signin' | 'create-account' | 'router';

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
        setScreen('router');
      } else {
        // If logged out, only redirect back if on router screen
        setScreen((prev) => (prev === 'router' ? 'welcome' : prev));
      }
    });
    return () => unsubscribe();
  }, []);

  // While splash screen is active or auth is checking, show the branded Splash Screen
  if (isSplashActive || isAuthChecking) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-blue-600 text-white font-sans transition-all duration-500 ease-in-out">
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 border border-white/20 shadow-xl">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            CivicPulse
          </h1>
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
    case 'router':
      return <RoleRouter onNavigate={setScreen} />;
    default:
      return <WelcomeScreen onNavigate={setScreen} />;
  }
}
