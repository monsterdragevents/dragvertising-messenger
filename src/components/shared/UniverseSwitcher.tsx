/**
 * Simplified Universe Switcher for Messenger
 * Allows seamless switching between universes within the messenger
 */

import { useState, useEffect } from 'react';
import { 
  Button, 
  Avatar, 
  AvatarFallback, 
  AvatarImage, 
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/lib/design-system';
import { ChevronDown, User } from 'lucide-react';
import { useUniverse, type Universe } from '@/hooks/shared/useUniverse';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface UniverseSwitcherProps {
  className?: string;
  variant?: 'desktop' | 'mobile' | 'auto';
}

export function UniverseSwitcher({ className }: UniverseSwitcherProps) {
  const { user } = useAuth();
  const { universe, availableUniverses, switchUniverse, refreshUniverses } = useUniverse();
  const [isOpen, setIsOpen] = useState(false);

  // Refresh universes when dropdown opens
  useEffect(() => {
    if (isOpen && refreshUniverses) {
      refreshUniverses();
    }
  }, [isOpen, refreshUniverses]);

  if (!user || !universe) {
    return null;
  }

  // Get role display name
  const getRoleLabel = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Get role color (simplified)
  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      talent: 'bg-purple-500',
      dj: 'bg-blue-500',
      producer: 'bg-green-500',
      fan: 'bg-pink-500',
      venue: 'bg-orange-500',
      production_co: 'bg-indigo-500',
    };
    return colors[role] || 'bg-primary';
  };

  const handleSwitch = async (targetUniverse: Universe) => {
    if (targetUniverse.id === universe.id) {
      setIsOpen(false);
      return;
    }

    await switchUniverse(targetUniverse.id);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'flex items-center gap-2 h-auto p-1.5 hover:bg-muted/50 transition-colors',
            className
          )}
          aria-label={`${universe.display_name} menu`}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={universe.avatar_url || undefined} alt={universe.display_name} />
            <AvatarFallback className={getRoleColor(universe.role)}>
              <User className="h-4 w-4 text-white" />
            </AvatarFallback>
          </Avatar>
          <div className="text-left min-w-0 hidden sm:block">
            <div className="font-medium text-sm truncate max-w-[120px]">
              {universe.display_name}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[120px]">
              {getRoleLabel(universe.role)}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[280px]">
        {/* Current Universe Info */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={universe.avatar_url || undefined} alt={universe.display_name} />
              <AvatarFallback className={getRoleColor(universe.role)}>
                <User className="h-5 w-5 text-white" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{universe.display_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.email}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  {getRoleLabel(universe.role)}
                </Badge>
                {universe.handle && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    @{universe.handle}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Available Universes */}
        {availableUniverses.length > 1 && (
          <>
            <div className="px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Switch Universe
              </div>
              <div className="space-y-1">
                {availableUniverses
                  .filter((u) => u.id !== universe.id)
                  .map((targetUniverse) => (
                    <button
                      key={targetUniverse.id}
                      onClick={() => handleSwitch(targetUniverse)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={targetUniverse.avatar_url || undefined}
                          alt={targetUniverse.display_name}
                        />
                        <AvatarFallback className={getRoleColor(targetUniverse.role)}>
                          <User className="h-3.5 w-3.5 text-white" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {targetUniverse.display_name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {getRoleLabel(targetUniverse.role)}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Current Universe (marked as active) */}
        <div className="px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">Current</div>
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
            <Avatar className="h-8 w-8">
              <AvatarImage src={universe.avatar_url || undefined} alt={universe.display_name} />
              <AvatarFallback className={getRoleColor(universe.role)}>
                <User className="h-3.5 w-3.5 text-white" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{universe.display_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {getRoleLabel(universe.role)}
              </div>
            </div>
            <Badge variant="default" className="text-xs">
              Active
            </Badge>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

