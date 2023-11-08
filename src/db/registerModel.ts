import type { ModelStaticMembers } from '../common/types';

const REGISTERED_MODELS: ModelStaticMembers[] = [];

export function registerModel<T extends ModelStaticMembers>(model: T) {
  REGISTERED_MODELS.push(model);
}

export function getRegisteredModels(): ModelStaticMembers[] {
  return REGISTERED_MODELS;
}
