import type { SystemRole, UserStatus, CompanyStatus } from "@prisma/client";

export type { SystemRole, UserStatus, CompanyStatus };

export interface User {
  id: string;
  authId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: UserStatus;
  companyId?: string | null;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
  settings?: unknown;
}

export interface UserWithRole extends User {
  role: RoleWithPermissions;
  company?: Company | null;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  systemRole: SystemRole;
  isSystem: boolean;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  resource: string;
  action: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  status: CompanyStatus;
  settings?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  user: UserWithRole;
  permissions: string[];
}

export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  /** Texte lu par les lecteurs d'écran à la place de la pastille (ex. « 3 nouveaux »). */
  badgeLabel?: string;
  /** Titre de section du menu ; les entrées consécutives d'un même groupe sont rendues ensemble. */
  group?: string;
  disabled?: boolean;
  disabledReason?: string;
  children?: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface DashboardStat {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  /** Masque la colonne en dessous du breakpoint md (mobile / tablette étroite). */
  hideOnMobile?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
