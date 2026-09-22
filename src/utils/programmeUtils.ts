import { Project } from '../types';

export const DUPLICATE_PROGRAMME_CONFIG_ERROR =
  'Programme configuration already exists for this State, Year, Phase and Cycle.';

/**
 * Normalizes programme name by trimming, lowercasing, and stripping whitespace/hyphens/underscores
 * so that 'DDU-GKY 2.0', 'DDUGKY 2.0', and 'ddu gky 2.0' match consistently.
 */
export function normalizeProgrammeName(name?: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[\s\-_]+/g, '');
}

/**
 * Normalizes state name. Defaults to 'all states'.
 */
export function normalizeProgrammeState(state?: string): string {
  if (!state) return 'all states';
  const s = state.trim().toLowerCase();
  if (s === 'all' || s === 'all states' || s === 'all-states') return 'all states';
  return s;
}

/**
 * Normalizes year string. Defaults to '2026-27'.
 */
export function normalizeProgrammeYear(year?: string): string {
  if (!year) return '2026-27';
  return year.trim().toLowerCase();
}

/**
 * Normalizes phase string (e.g. 'Phase 1', 'Phase-1', 'phase 1' -> 'phase1').
 * Treats 'none', 'all', '—', '-', 'n/a', 'general' as empty.
 */
export function normalizeProgrammePhase(phase?: string): string {
  if (!phase) return '';
  const p = phase.trim().toLowerCase();
  if (
    p === 'none' ||
    p === 'all' ||
    p === '—' ||
    p === '-' ||
    p === 'n/a' ||
    p === 'general' ||
    p === 'all phases' ||
    p === 'none / general'
  ) {
    return '';
  }
  return p.replace(/[\s\-_]+/g, '');
}

/**
 * Normalizes cycle string (e.g. 'Cycle 1', 'Cycle-1', 'cycle 1' -> 'cycle1').
 * Treats 'none', 'all', '—', '-', 'n/a', 'general' as empty.
 */
export function normalizeProgrammeCycle(cycle?: string): string {
  if (!cycle) return '';
  const c = cycle.trim().toLowerCase();
  if (
    c === 'none' ||
    c === 'all' ||
    c === '—' ||
    c === '-' ||
    c === 'n/a' ||
    c === 'general' ||
    c === 'all cycles' ||
    c === 'none / general'
  ) {
    return '';
  }
  return c.replace(/[\s\-_]+/g, '');
}

/**
 * Generates the canonical configuration key for:
 * Programme + State + Year + Phase + Cycle
 */
export function makeProgrammeConfigKey(
  programme: string,
  state?: string,
  year?: string,
  phase?: string,
  cycle?: string
): string {
  return [
    normalizeProgrammeName(programme),
    normalizeProgrammeState(state),
    normalizeProgrammeYear(year),
    normalizeProgrammePhase(phase),
    normalizeProgrammeCycle(cycle),
  ].join(':::');
}

/**
 * Extracts all unique 5-tuple configuration keys for a project:
 * Programme + State + Year + Phase + Cycle
 */
export function getProjectConfigurationKeys(p: {
  name: string;
  state?: string;
  year?: string;
  phase?: string;
  cycle?: string;
  phases?: string[];
  cycles?: string[];
}): string[] {
  const pName = p.name || '';
  const pState = p.state || 'All States';
  const pYear = p.year || '2026-27';

  let phaseList: string[] = [];
  if (Array.isArray(p.phases) && p.phases.length > 0) {
    phaseList = p.phases.map((x) => String(x).trim()).filter(Boolean);
  } else if (p.phase && String(p.phase).trim()) {
    phaseList = [String(p.phase).trim()];
  }
  if (phaseList.length === 0) {
    phaseList = [''];
  }

  let cycleList: string[] = [];
  if (Array.isArray(p.cycles) && p.cycles.length > 0) {
    cycleList = p.cycles.map((x) => String(x).trim()).filter(Boolean);
  } else if (p.cycle && String(p.cycle).trim()) {
    cycleList = [String(p.cycle).trim()];
  }
  if (cycleList.length === 0) {
    cycleList = [''];
  }

  const keys = new Set<string>();
  for (const ph of phaseList) {
    for (const cy of cycleList) {
      keys.add(makeProgrammeConfigKey(pName, pState, pYear, ph, cy));
    }
  }
  return Array.from(keys);
}

/**
 * Formats a project configuration into a human-readable display label:
 * e.g. "DDU-GKY 2.0 • Assam • 2026-27 • Phase 1 • Cycle 1"
 */
export function formatProgrammeConfigurationLabel(p: {
  name: string;
  state?: string;
  year?: string;
  phase?: string;
  cycle?: string;
  phases?: string[];
  cycles?: string[];
}): string {
  const parts: string[] = [p.name || 'Unnamed Programme'];
  if (p.state) parts.push(p.state);
  if (p.year) parts.push(p.year);

  const phase = p.phase || (p.phases && p.phases.length > 0 ? p.phases.join(', ') : '');
  if (phase && phase !== 'None / General') parts.push(phase);

  const cycle = p.cycle || (p.cycles && p.cycles.length > 0 ? p.cycles.join(', ') : '');
  if (cycle && cycle !== 'None / General') parts.push(cycle);

  return parts.join(' • ');
}
