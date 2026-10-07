import { deleteCache } from './cache.js';

export const invalidateAdminDashboardCache = async () => {
  await Promise.all([
    deleteCache('admin:stats'),
    deleteCache('admin:trends'),
    deleteCache('admin:langstats'),
  ]);
};
