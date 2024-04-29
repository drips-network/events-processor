import type { ModelStaticMembers } from '../core/types';
import {
  AccountMetadataEmittedEventModel,
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  GitProjectModel,
  OwnerUpdateRequestedEventModel,
  OwnerUpdatedEventModel,
  RepoDriverSplitReceiverModel,
  TransferEventModel,
  GivenEventModel,
  SplitsSetEventModel,
  StreamsSetEventModel,
  StreamReceiverSeenEventModel,
} from '../models';
import SplitEventModel from '../models/SplitEventModel';
import SqueezedStreamsEventModel from '../models/SqueezedStreamsEventModel';

const REGISTERED_MODELS: ModelStaticMembers[] = [];

function registerModel<T extends ModelStaticMembers>(model: T) {
  REGISTERED_MODELS.push(model);
}

export function getRegisteredModels(): ModelStaticMembers[] {
  return REGISTERED_MODELS;
}

export function registerModels(): void {
  registerModel(DripListModel);
  registerModel(GivenEventModel);
  registerModel(SplitEventModel);
  registerModel(GitProjectModel);
  registerModel(TransferEventModel);
  registerModel(StreamsSetEventModel);
  registerModel(SplitsSetEventModel);
  registerModel(OwnerUpdatedEventModel);
  registerModel(SqueezedStreamsEventModel);
  registerModel(DripListSplitReceiverModel);
  registerModel(StreamReceiverSeenEventModel);
  registerModel(RepoDriverSplitReceiverModel);
  registerModel(OwnerUpdateRequestedEventModel);
  registerModel(AddressDriverSplitReceiverModel);
  registerModel(AccountMetadataEmittedEventModel);
}
