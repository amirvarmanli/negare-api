import { RoleName } from '@prisma/client';

export type PermissionDefinition = {
  key: string;
  title: string;
  group: string;
};

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  { key: 'admin.dashboard:read', title: 'View dashboard', group: 'Dashboard' },
  { key: 'admin.products:read', title: 'View products', group: 'Products' },
  {
    key: 'admin.products:manage',
    title: 'Manage products',
    group: 'Products',
  },
  {
    key: 'admin.categories:manage',
    title: 'Manage categories',
    group: 'Categories',
  },
  { key: 'admin.blog:manage', title: 'Manage blog', group: 'Blog' },
  {
    key: 'admin.newsletter:manage',
    title: 'Manage newsletter',
    group: 'Newsletter',
  },
  { key: 'admin.users:read', title: 'View users', group: 'Users' },
  { key: 'admin.users:manage', title: 'Manage users', group: 'Users' },
  { key: 'admin.finance:read', title: 'View finance', group: 'Finance' },
  {
    key: 'admin.finance:manage',
    title: 'Manage finance',
    group: 'Finance',
  },
  { key: 'admin.orders:read', title: 'View orders', group: 'Orders' },
  {
    key: 'admin.orders:manage',
    title: 'Manage orders',
    group: 'Orders',
  },
  {
    key: 'admin.notifications:send',
    title: 'Send notifications',
    group: 'Notifications',
  },
  {
    key: 'admin.notifications:read',
    title: 'View notifications history',
    group: 'Notifications',
  },
  {
    key: 'admin.comments:moderate',
    title: 'Moderate comments',
    group: 'Comments',
  },
  { key: 'admin.ads:manage', title: 'Manage ads', group: 'Ads' },
  {
    key: 'admin.settings:manage',
    title: 'Manage settings',
    group: 'Settings',
  },
  {
    key: 'admin.staticContent:manage',
    title: 'Manage static content',
    group: 'Static Content',
  },
  {
    key: 'supplier.products:read',
    title: 'View supplier products',
    group: 'Products',
  },
  {
    key: 'supplier.products:manage',
    title: 'Manage supplier products',
    group: 'Products',
  },
  {
    key: 'supplier.orders:read',
    title: 'View supplier orders',
    group: 'Orders',
  },
  {
    key: 'user.profile:read',
    title: 'View profile',
    group: 'Profile',
  },
  {
    key: 'user.profile:update',
    title: 'Update profile',
    group: 'Profile',
  },
  {
    key: 'user.notifications:read',
    title: 'View notifications',
    group: 'Notifications',
  },
  {
    key: 'user.notifications:manage',
    title: 'Manage notifications',
    group: 'Notifications',
  },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS_CATALOG.map(
  (permission) => permission.key,
);

export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  [RoleName.admin]: ALL_PERMISSION_KEYS,
  [RoleName.supplier]: ALL_PERMISSION_KEYS.filter(
    (key) => key.startsWith('supplier.') || key.startsWith('user.'),
  ),
  [RoleName.user]: ALL_PERMISSION_KEYS.filter((key) =>
    key.startsWith('user.'),
  ),
};
