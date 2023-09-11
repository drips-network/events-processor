import type { UUID } from 'crypto';
import type { Transaction } from 'sequelize';
import isProjectId from '../models/AccountMetadataEmittedEvent/isProjectId';
import type {
  EventSignature,
  NftDriverAccountId,
  ProjectId,
} from '../common/types';
import isNftDriverAccountId from '../models/AccountMetadataEmittedEvent/dripList/isNftDriverAccountId';

export function assertTransaction(
  transaction: Transaction | null | undefined,
): asserts transaction is Transaction {
  if (!transaction) {
    throw new Error('Transaction is required.');
  }
}

export function assertUUID(uuid: string): asserts uuid is UUID {
  const regex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!regex.test(uuid)) {
    throw new Error('Not a valid UUID');
  }
}

export function assertRequestId(requestId: string): asserts requestId is UUID {
  const uuidRegExp =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegExp.test(requestId)) {
    throw new Error(`$Request ID {requestId} is not a valid UUID.`);
  }
}

export function assertProjectId(id: string): asserts id is ProjectId {
  if (!isProjectId(id)) {
    throw new Error(`Project ID ${id} is not a valid ProjectId.`);
  }
}

export function assertNftDriverAccountId(
  id: string,
): asserts id is NftDriverAccountId {
  if (!isNftDriverAccountId(id)) {
    throw new Error(`ID ${id} is not a valid NftDriverAccountId.`);
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
