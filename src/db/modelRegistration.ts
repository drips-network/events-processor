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
  _LastIndexedBlockModel,
  SplitEventModel,
  SqueezedStreamsEventModel,
  SubListModel,
  CreatedSplitsEventModel,
  EcosystemModel,
  SubListSplitReceiverModel,
} from '../models';

const REGISTERED_MODELS: ModelStaticMembers[] = [];

function registerModel<T extends ModelStaticMembers>(model: T) {
  REGISTERED_MODELS.push(model);
}

export function getRegisteredModels(): ModelStaticMembers[] {
  return REGISTERED_MODELS;
}

export function registerModels(): void {
  registerModel(_LastIndexedBlockModel);

  registerModel(SubListModel);
  registerModel(DripListModel);
  registerModel(GivenEventModel);
  registerModel(SplitEventModel);
  registerModel(GitProjectModel);
  registerModel(EcosystemModel);
  registerModel(TransferEventModel);
  registerModel(SplitsSetEventModel);
  registerModel(StreamsSetEventModel);
  registerModel(OwnerUpdatedEventModel);
  registerModel(CreatedSplitsEventModel);
  registerModel(SqueezedStreamsEventModel);
  registerModel(SubListSplitReceiverModel);
  registerModel(DripListSplitReceiverModel);
  registerModel(StreamReceiverSeenEventModel);
  registerModel(RepoDriverSplitReceiverModel);
  registerModel(OwnerUpdateRequestedEventModel);
  registerModel(AddressDriverSplitReceiverModel);
  registerModel(AccountMetadataEmittedEventModel);
}
