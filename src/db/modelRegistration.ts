import type { ModelStaticMembers } from '../core/types';
import {
  AccountMetadataEmittedEventModel,
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  ProjectModel,
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
  EcosystemMainAccountModel,
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
  registerModel(ProjectModel);
  registerModel(EcosystemMainAccountModel);
  registerModel(TransferEventModel);
  registerModel(SplitsSetEventModel);
  registerModel(StreamsSetEventModel);
  registerModel(OwnerUpdatedEventModel);
  registerModel(SqueezedStreamsEventModel);
  registerModel(SubListSplitReceiverModel);
  registerModel(DripListSplitReceiverModel);
  registerModel(StreamReceiverSeenEventModel);
  registerModel(RepoDriverSplitReceiverModel);
  registerModel(OwnerUpdateRequestedEventModel);
  registerModel(AddressDriverSplitReceiverModel);
  registerModel(AccountMetadataEmittedEventModel);
}
