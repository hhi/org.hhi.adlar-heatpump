/* eslint-disable import/prefer-default-export */
/** The Aurora II and Tuya pages load the same stylesheets. Only these paths are served. */
export const DASHBOARD_PAGE_STYLES: Record<string, string> = {
  '/': 'dashboard.css',
  '/live': 'dashboard-live.css',
  '/interactive': 'dashboard-interactive.css',
  '/expert': 'dashboard-expert.css',
  '/changelog': 'dashboard-changelog.css',
  '/heating-curve': 'heating_curve_line.css',
};
