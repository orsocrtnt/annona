"use client";
import { DriverServiceControl } from "@/features/driver/driver-service-control";
import { OrderMessagesInbox } from "@/components/shared/order-conversation";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { formatDriverFromParts } from "@/lib/format/person-labels";
import { Home, MapPin, User } from "lucide-react";
import { useNavQueryPrefetch } from "@/hooks/use-nav-query-prefetch";
import { AppleNavbar } from "@/components/navigation/apple-navbar";

const bottomNav = [
  { title: "Accueil", href: "/driver", icon: Home },
  { title: "Missions", href: "/driver/missions", icon: MapPin },
  { title: "Profil", href: "/driver/profile", icon: User },
];

function DriverBottomNavLink({
  item,
  isActive,
}: {
  item: (typeof bottomNav)[number];
  isActive: boolean;
}) {
  const prefetchHandlers = useNavQueryPrefetch(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      {...prefetchHandlers}
      className={cn(
        "flex min-h-[56px] min-w-[72px] flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 transition-all active:bg-muted",
        isActive ? "text-brand" : "text-muted-foreground"
      )}
    >
      <Icon className={cn("h-6 w-6", isActive && "scale-110")} />
      <span className="text-xs font-medium">{item.title}</span>
    </Link>
  );
}

interface DriverAppLayoutProps {
  children: React.ReactNode;
}

export function DriverAppLayout({ children }: DriverAppLayoutProps) {
  const pathname = usePathname();
  const isNavigationPage = pathname.startsWith("/driver/navigate");
  const { user } = useAuth();

  if (isNavigationPage) {
    return <div className="min-h-screen bg-background"><main id="main-content" tabIndex={-1}>{children}</main></div>;
  }

  return (
    <div className="relative min-h-screen bg-background pb-24">
      <AppleNavbar maxWidthClassName="max-w-lg" innerClassName="justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-[#dce7ef] text-xs font-semibold text-[#243447]">
              {user ? getInitials(user.firstName, user.lastName) : "D"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="truncate text-sm font-medium leading-none text-white">
              {user
                ? formatDriverFromParts(
                    { firstName: user.firstName, lastName: user.lastName },
                    null
                  )
                : "Livreur"}
            </p>
            <p className="mt-0.5 truncate text-xs text-white/45">
              État GPS et synchronisation affichés ci-dessous
            </p>
          </div>
        </div>
      </AppleNavbar>

      <main id="main-content" tabIndex={-1}><DriverServiceControl /><OrderMessagesInbox />{children}</main>

      <nav aria-label="Navigation chauffeur" className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {bottomNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <DriverBottomNavLink key={item.href} item={item} isActive={isActive} />
            );
          })}
        </div>
      </nav>
    </div>
  );
}
