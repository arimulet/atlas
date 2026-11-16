export const INITIAL_VISIBLE_DEVELOPMENT_PATH_STEPS = 8;

export function visibleDevelopmentPath<T>(path: readonly T[], isExpanded: boolean): readonly T[] {
  return isExpanded ? path : path.slice(0, INITIAL_VISIBLE_DEVELOPMENT_PATH_STEPS);
}

export function hasHiddenDevelopmentPathSteps(path: readonly unknown[]): boolean {
  return path.length > INITIAL_VISIBLE_DEVELOPMENT_PATH_STEPS;
}
