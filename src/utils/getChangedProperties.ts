import type { Model } from 'sequelize';

export type ChangedProperties = {
  [key: string]: { old: any; new: any };
};

export default function getChangedProperties(
  instance: Model,
): ChangedProperties {
  const changedKeys = instance.changed();
  const changedProps: ChangedProperties = {};

  if (changedKeys && changedKeys.length > 0) {
    for (const key of changedKeys) {
      changedProps[key] = {
        old: instance.previous(key),
        new: instance.get(key),
      };
    }
  }

  return changedProps;
}
