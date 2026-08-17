export function getRecoveryPlanInputSignature(sourceCheckoutId) {
  return `recovery:${sourceCheckoutId ?? 'standalone'}`
}

export function findRecoveryPlanForCheckout(recoveryPlans = [], sourceCheckoutId) {
  if (!sourceCheckoutId) return null
  return recoveryPlans.find((record) => record?.sourceCheckoutId === sourceCheckoutId) ?? null
}

export function createCheckoutRecoveryPlan(recommendation, checkout, generatedAt = new Date().toISOString()) {
  if (!recommendation || !checkout?.id) return null
  return {
    ...recommendation,
    generatedAt: recommendation.generatedAt ?? generatedAt,
    recordType: 'recovery_plan',
    routine: undefined,
    sourceCheckoutId: checkout.id,
  }
}
