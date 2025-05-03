import type { ModelStaticMembers } from '../core/types';
import {
  AccountMetadataEmittedEventModel,
  DripListModel,
  ProjectModel,
  TransferEventModel,
  GivenEventModel,
  StreamsSetEventModel,
  StreamReceiverSeenEventModel,
  LastIndexedBlockModel,
  SplitEventModel,
  SqueezedStreamsEventModel,
  SubListModel,
  EcosystemMainAccountModel,
  SplitReceiverModel,
  OwnerUpdatedEventModel,
} from '../models';
import SplitsSetEventModel from '../models/SplitsSetEventModel';

const REGISTERED_MODELS: ModelStaticMembers[] = [];

function registerModel<T extends ModelStaticMembers>(model: T) {
  REGISTERED_MODELS.push(model);
}

export function getRegisteredModels(): ModelStaticMembers[] {
  return REGISTERED_MODELS;
}

export function registerModels(): void {
  registerModel(LastIndexedBlockModel);

  registerModel(SubListModel);
  registerModel(ProjectModel);
  registerModel(DripListModel);
  registerModel(GivenEventModel);
  registerModel(SplitEventModel);
  registerModel(TransferEventModel);
  registerModel(SplitReceiverModel);
  registerModel(SplitsSetEventModel);
  registerModel(StreamsSetEventModel);
  registerModel(OwnerUpdatedEventModel);
  registerModel(EcosystemMainAccountModel);
  registerModel(SqueezedStreamsEventModel);
  registerModel(StreamReceiverSeenEventModel);
  registerModel(AccountMetadataEmittedEventModel);
}
