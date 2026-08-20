# Weekly Training Intelligence Calibration

## Alcance

La Iteración 5 agrega una capa de diagnóstico sobre las Iteraciones 1–4. No
persiste scores ni recomendaciones, no cambia la configuración de Sokker y no
agrega decisiones estratégicas nuevas.

El reporte se ejecuta con:

```bash
MONGODB_URI="..." ATLAS_CALIBRATION_CLUB_ID="..." npm run training:calibrate
```

En PowerShell:

```powershell
$env:MONGODB_URI = "..."
$env:ATLAS_CALIBRATION_CLUB_ID = "..."
npm run training:calibrate
```

`ATLAS_CALIBRATION_GAME_WEEK` es opcional. El club y la semana se reciben por
configuración para evitar IDs reales hardcodeados en producción.

## Dataset

La selección se realiza desde los historiales y snapshots persistidos. El
selector prioriza cobertura de historial largo/corto, talento estimado o
incierto, skill-ups observados y recientes, cambios y repeticiones de skill,
advanced, formation y jugadores jóvenes/mayores. Selecciona como máximo 12
jugadores y mantiene el ranking advanced sobre el universo elegible completo.

## Métricas y warnings

El comando informa MAE y proporción de predicciones dentro de media, una y dos
semanas. Las observaciones sin ETA calculable se excluyen del error agregado y
se conservan como evidencia insuficiente. También reporta:

- `insufficient_history`
- `missing_last_skill_up`
- `prediction_error_high`
- `unstable_talent_estimate`
- `recommendation_flapping`
- `advanced_rank_instability`
- `inconsistent_training_history`

Las razones son códigos de dominio; la UI productiva no necesita conocer estos
detalles de debugging.

## Thresholds vigentes

Los thresholds estratégicos existentes no fueron modificados por esta
iteración:

- cambio de skill: `TRAINING_RECOMMENDATION_SWITCH_THRESHOLD = 1.15`;
- cambio reciente: `TRAINING_RECOMMENDATION_RECENT_SWITCH_THRESHOLD = 1.25`;
- reemplazo de slot advanced: `ADVANCED_SLOT_REPLACEMENT_THRESHOLD = 0.05`;
- error de predicción diagnosticado como alto: `1` semana;
- movimiento de ranking diagnosticado como inestable: `2` posiciones;
- ventana de inspección del cutoff: posiciones `8` a `12`.

Los thresholds de diagnóstico no modifican recomendaciones. No se ajustaron
fórmulas ni thresholds estratégicos sin una corrida contra datos reales.

## Estado de validación

La implementación incluye fixtures deterministas para MAE, predicción exacta y
errónea, censura izquierda, flapping, estabilidad de ranking, sensibilidad al
talento y descomposición de scores. En el entorno de desarrollo de esta
entrega no están disponibles `MONGODB_URI` ni `ATLAS_CALIBRATION_CLUB_ID`, por
lo que no se registran aquí métricas reales ni se presentan números inventados.

La corrida real debe conservar el output del comando junto con la semana
analizada para completar: cantidad de semanas disponibles, skill-ups
observados, MAE, estabilidad del cutoff y cambios de reemplazo.

## Limitaciones conocidas

- Historial iniciado a mitad de nivel no produce progreso ni ETA artificiales.
- El backtest sólo cuenta una observación cuando la semana previa al skill-up
  está disponible y entrenaba esa misma skill.
- La estabilidad de ranking requiere pasar el ranking de la semana anterior;
  el contrato ya permite ese diagnóstico, pero no se persiste.
- El diagnóstico de flapping identifica inversiones consecutivas de una
  recomendación (`A → B → A`); no intenta explicar eventos tácticos.
- La sensibilidad de talento inspecciona el score bajo `talent ± uncertainty`,
  pero no recalcula ni reemplaza el algoritmo de estimación de talento.

## Decisiones de calibración

No se realizaron ajustes de comportamiento estratégico antes de observar el
dataset real. Esta decisión evita overfitting a fixtures o a una única semana
del club.
