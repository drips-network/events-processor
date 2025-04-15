import type { ModelStaticMembers } from '../core/types';
import {
  AccountMetadataEmittedEventModel,
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  Project,
  RepoDriverSplitReceiverModel,
  TransferEventModel,
  GivenEventModel,
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
  registerModel(Project);
  registerModel(EcosystemMainAccountModel);
  registerModel(TransferEventModel);
  registerModel(StreamsSetEventModel);
  registerModel(SqueezedStreamsEventModel);
  registerModel(SubListSplitReceiverModel);
  registerModel(DripListSplitReceiverModel);
  registerModel(StreamReceiverSeenEventModel);
  registerModel(RepoDriverSplitReceiverModel);
  registerModel(AddressDriverSplitReceiverModel);
  registerModel(AccountMetadataEmittedEventModel);
}
