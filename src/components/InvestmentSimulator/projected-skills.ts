interface ProjectedSkillStep {
  skill: string;
  level: number;
  residualChanges?: readonly { skill: string; level: number }[];
}

export function buildProjectedSkillSnapshots(
  initialSkills: Record<string, number>,
  steps: readonly ProjectedSkillStep[]
): Record<string, number>[] {
  const skills = { ...initialSkills };
  return steps.map((step) => {
    for (const change of step.residualChanges ?? []) skills[change.skill] = change.level;
    skills[step.skill] = step.level;
    return { ...skills };
  });
}
