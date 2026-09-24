import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FileText,
  Handshake,
  Home,
  Inbox,
  Kanban,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon as NavIconName } from "./nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  today: Home,
  workout: Dumbbell,
  progress: TrendingUp,
  credits: CreditCard,
  profile: User,
  clients: Users,
  programs: ClipboardList,
  schedule: CalendarDays,
  numbers: BarChart3,
  team: ShieldCheck,
  pipeline: Kanban,
  leads: UserPlus,
  deals: Handshake,
  queue: Inbox,
  checkin: ClipboardCheck,
  overview: LayoutDashboard,
  branches: Building2,
  sales: Target,
  coaching: Dumbbell,
  money: Wallet,
  targets: Target,
  people: Users,
  settings: Settings,
  audit: ScrollText,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name] ?? FileText;
  return <Icon aria-hidden className={className} />;
}
