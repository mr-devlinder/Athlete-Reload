export const evidenceRegistry = {
  readiness: {
    version: '2.0.0',
    applicability: 'Decision support for athletes age 16 and older; not medical clearance.',
    assumptions: ['Self-reported inputs are current', 'Missing optional logs are neutral', 'Safety findings override performance optimization'],
    certainty: 'Readiness is an interpretable estimate, not a clinical measurement.',
    reviewedAt: '2026-08-11',
  },
  nutrition: {
    version: '2.0.0',
    applicability: 'Planning ranges for athletes age 16 and older.',
    assumptions: ['Body measurements and activity plan are approximate', 'Targets are starting points, not exact requirements'],
    certainty: 'Estimated range; individual needs vary.',
    reviewedAt: '2026-08-11',
  },
  hydration: {
    version: '2.0.0',
    applicability: 'Daily and event hydration planning without measured sweat rate.',
    assumptions: ['Environment and intensity may be unknown', 'Fluid from food is not fully captured'],
    certainty: 'Practical range; thirst, urine color, and known sweat loss add useful context.',
    reviewedAt: '2026-08-11',
  },
}
