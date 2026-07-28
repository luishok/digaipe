export const REPORT_MODES = ['general', 'consolidado', 'estadisticas', 'reconciliacion'] as const;

export type ReportMode = (typeof REPORT_MODES)[number];

export function parseReportMode(value: string): ReportMode | null {
	return REPORT_MODES.includes(value as ReportMode) ? (value as ReportMode) : null;
}
