# Training History, Skill Changes y Talent

ATLAS usa los reportes oficiales de `Sokker /training` como fuente factual:

```text
TrainingReport -> PlayerTrainingWeek -> SkillChange -> TalentEvidence
               -> TalentEstimate -> Projection
```

`TrainingHistory` almacena hechos oficiales de cada entrenamiento semanal: semana, temporada,
fecha, `trainedSkill`, `kind`, intensidad, edad, skills visibles y `skillsChange`. No contiene
minutos de partidos, partidos ni cálculos predictivos. `TrainingKind` conserva `advanced`,
`formation` y `missing`; `individual` de la API se mapea a `advanced`.

Los eventos `SkillChange` se derivan de `report.skills` y `report.skillsChange`:

```text
after = report.skills[skill]
delta = report.skillsChange[skill]
before = after - delta
```

Sólo se crean eventos con `delta !== 0`. Los contadores `skillsChange.up` y `down` se validan y
se registran si no coinciden, pero los deltas individuales son la fuente principal. Los drops se
conservan como eventos observados y no alimentan talento positivo.

`SkillUp` permanece como una proyección de compatibilidad para consumidores antiguos; ya no
se persiste por separado ni es la fuente de talento. El flujo nuevo consume `TrainingHistory.skillChanges`.
Player Snapshots se mantienen para evolución general, squad history, valor y validación histórica.

## Talent V1

Una evidencia válida sólo es un intervalo completo `pop -> pop` de la misma skill:

- existe un pop inicial conocido y un pop final conocido;
- ambos son de una sola skill y de un nivel al siguiente;
- todos los reportes entre ambos están presentes, sin huecos de semanas;
- el entrenamiento es `advanced` de esa skill;
- `intensity` está disponible en cada reporte;
- `kind = missing` con `intensity = 0` es una semana reportada sin entrenamiento y puede integrar el intervalo.

El primer pop observado no es evidencia completa porque se desconoce el subnivel inicial. Una
semana sin reporte es distinta de un reporte `missing` y vuelve inelegible el intervalo. Formation
se persiste, pero invalida Talent V1 dentro del intervalo: no se introduce un `formationFactor`.
Cambiar de skill también invalida el ciclo conservador.

Cada `TalentEvidence` conserva la skill, niveles, semanas, puntos acumulados, talento estimado y
confidence numérica. `TalentEstimator` combina las evidencias válidas, ignora un outlier claramente
aislado y devuelve `value = null`/`unknown` cuando no hay evidencia.

La política inicial de confidence es explícita: 0 evidencias = `unknown`, 1 = `low`, 2 = `medium`,
3 o más = `high`, con reducción por dispersión alta.
