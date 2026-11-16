interface ProjectedSkillStep {
  skill: string;
  level: number;
}

export function buildProjectedSkillSnapshots(
  initialSkills: Record<string, number>,
  steps: readonly ProjectedSkillStep[]
): Record<string, number>[] {
  const skills = { ...initialSkills };
  return steps.map((step) => {
    skills[step.skill] = step.level;
    return { ...skills };
  });
}
