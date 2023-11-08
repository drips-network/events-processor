import type { UUID } from 'crypto';
import type { Transaction } from 'sequelize';
import type { Dependency, DependencyOfProjectType } from '../common/types';
import type { EventSignature } from '../eventsConfiguration/types';

export function assertTransaction(
  transaction: Transaction | null | undefined,
): asserts transaction is Transaction {
  if (!transaction) {
    throw new Error('Transaction is required.');
  }
}

export function assertRequestId(requestId: string): asserts requestId is UUID {
  const uuidRegExp =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  if (!uuidRegExp.test(requestId)) {
    throw new Error(`Request ID ${requestId} is not a valid UUID.`);
  }
}

export function assertEventSignature<T extends EventSignature>(
  eventSignature: string,
  expectedEventSignature: EventSignature,
): asserts eventSignature is T {
  if (eventSignature !== expectedEventSignature) {
    throw new Error(
      `Event signature ${eventSignature} does not match expected event signature ${expectedEventSignature}.`,
    );
  }
}

export function isDependencyOfProjectType(
  dependency: Dependency,
): dependency is DependencyOfProjectType {
  return 'source' in dependency;
}

export function assertDependencyOfProjectType(
  project: Dependency,
): asserts project is DependencyOfProjectType {
  if (!isDependencyOfProjectType(project)) {
    throw new Error(
      `Dependency with account ID ${project.accountId} is not a valid DependencyOfProjectType.`,
    );
  }
}
