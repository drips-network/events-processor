import type { ModelStaticMembers } from '../core/types';
import {
  AccountMetadataEmittedEventModel,
  DripListModel,
  ProjectModel,
  TransferEventModel,
  GivenEventModel,
  StreamsSetEventModel,
  StreamReceiverSeenEventModel,
  _LastIndexedBlockModel,
  SplitEventModel,
  SqueezedStreamsEventModel,
  SubListModel,
  EcosystemMainAccountModel,
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
  registerModel(TransferEventModel);
  registerModel(StreamsSetEventModel);
  registerModel(EcosystemMainAccountModel);
  registerModel(SqueezedStreamsEventModel);
  registerModel(StreamReceiverSeenEventModel);
  registerModel(AccountMetadataEmittedEventModel);
}
