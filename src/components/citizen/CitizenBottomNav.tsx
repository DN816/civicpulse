import React from 'react';
import { Map, SquarePlus, BarChart3, User } from 'lucide-react';
import { CitizenScreenType } from '../../screens/citizen/CitizenRouter';

interface CitizenBottomNavProps {
  currentScreen: CitizenScreenType;
  onNavigate: (screen: CitizenScreenType) => void;
}

function NavItem({
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}) {
  if (isActive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current="page"
        className="flex -translate-y-2 scale-110 flex-col items-center justify-center rounded-xl border-2 border-border bg-secondary-container px-4 py-2 text-secondary transition-transform active:scale-95"
      >
        <Icon className="h-6 w-6 fill-current" />
        <span className="mt-1 text-xs font-bold">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center p-2 text-on-surface-variant transition-all hover:bg-surface-container-high active:scale-95"
    >
      <Icon className="h-6 w-6" />
      <span className="mt-1 text-xs font-bold">{label}</span>
    </button>
  );
}

export default function CitizenBottomNav({ currentScreen, onNavigate }: CitizenBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around rounded-t-2xl border-t-4 border-border bg-surface px-2 pb-6 pt-3 shadow-[0_-4px_0_0_var(--cp-border)] md:hidden">
      <NavItem label="Map" icon={Map} isActive={currentScreen === 'map'} onClick={() => onNavigate('map')} />
      <NavItem label="Report" icon={SquarePlus} isActive={currentScreen === 'report'} onClick={() => onNavigate('report')} />
      <NavItem label="Tracking" icon={BarChart3} isActive={currentScreen === 'home'} onClick={() => onNavigate('home')} />
      <NavItem label="Profile" icon={User} isActive={currentScreen === 'profile'} onClick={() => onNavigate('profile')} />
    </nav>
  );
}
