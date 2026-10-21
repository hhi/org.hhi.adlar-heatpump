/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/* eslint-disable import/prefer-default-export */
import type { DashboardService } from '../services/dashboard-service';

/**
 * Wat een Aurora III-device van de app gebruikt (ADR-004 §5).
 *
 * De Aurora III-driver heeft een eigen dashboardinstantie naast die van Aurora II, op een
 * eigen poort en met eigen pagina's. Eén getypeerde interface in plaats van losse
 * `as unknown as`-casts per aanroep: een hernoeming in app.ts valt dan op bij `tsc`.
 */
export interface Aurora3AppHost {
  readonly aurora3Dashboard: DashboardService | null;
  setAurora3DashboardPort(port: number): Promise<void>;
}
