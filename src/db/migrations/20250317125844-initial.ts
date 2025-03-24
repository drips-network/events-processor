import { DataTypes, literal, type QueryInterface } from 'sequelize';
import { COMMON_EVENT_INIT_ATTRIBUTES, FORGES_MAP } from '../../core/constants';
import { ProjectVerificationStatus } from '../../models/GitProjectModel';
import getSchema from '../../utils/getSchema';
import { DependencyType, type DbSchema } from '../../core/types';
import { AddressDriverSplitReceiverType } from '../../models/AddressDriverSplitReceiverModel';

export async function up({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface = sequelize.getQueryInterface();

  await createTableIfNotExists(
    queryInterface,
    schema,
    '_LastIndexedBlock',
    createLastIndexedBlockTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'AccountMetadataEmittedEvents',
    createAccountMetadataEmittedEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'GitProjects',
    createProjectsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'DripLists',
    createDripListsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'AddressDriverSplitReceivers',
    createAddressDriverSplitReceiversTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'DripListSplitReceivers',
    createDripListSplitReceiversTable,
  );

  await createTableIfNotExists(
    queryInterface,
    schema,
    'GivenEvents',
    createGivenEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'OwnerUpdatedEvents',
    createOwnerUpdatedEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'OwnerUpdateRequestedEvents',
    createOwnerUpdateRequestedEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'RepoDriverSplitReceivers',
    createRepoDriverSplitReceiversTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'SplitEvents',
    createSplitEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'SplitsSetEvents',
    createSplitsSetEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'SqueezedStreamsEvents',
    createSqueezedStreamsEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'StreamReceiverSeenEvents',
    createStreamReceiverSeenEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'StreamsSetEvents',
    createStreamsSetEventsTable,
  );
  await createTableIfNotExists(
    queryInterface,
    schema,
    'TransferEvents',
    createTransferEventsTable,
  );
}

async function createTransferEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'TransferEvents', schema },
    {
      tokenId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      from: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      to: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );
}

async function createStreamsSetEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'StreamsSetEvents', schema },
    {
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      erc20: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      receiversHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      streamsHistoryHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      balance: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      maxEnd: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'StreamsSetEvents', schema },
    ['accountId'],
    {
      name: 'IX_StreamsSetEvents_accountId',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'StreamsSetEvents', schema },
    ['receiversHash'],
    {
      name: 'IX_StreamsSetEvents_receiversHash',
      unique: false,
    },
  );
}

async function createStreamReceiverSeenEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'StreamReceiverSeenEvents', schema },
    {
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      receiversHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      config: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'StreamReceiverSeenEvents', schema },
    ['accountId'],
    {
      name: 'IX_StreamReceiverSeenEvents_accountId',
      unique: false,
    },
  );
}

async function createSqueezedStreamsEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'SqueezedStreamsEvents', schema },
    {
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      erc20: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      senderId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amount: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      streamsHistoryHashes: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );
}

async function createSplitsSetEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'SplitsSetEvents', schema },
    {
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      receiversHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );
}

async function createSplitEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'SplitEvents', schema },
    {
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      receiver: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      erc20: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amt: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'SplitEvents', schema },
    ['receiver'],
    {
      name: 'IX_SplitEvents_receiver',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'SplitEvents', schema },
    ['accountId', 'receiver'],
    {
      name: 'IX_SplitEvents_accountId_receiver',
      unique: false,
    },
  );
}

async function createRepoDriverSplitReceiversTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'RepoDriverSplitReceivers', schema },
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      fundeeProjectId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      funderProjectId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      funderDripListId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      weight: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM(...Object.values(DependencyType)),
        allowNull: false,
      },
      blockTimestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'RepoDriverSplitReceivers', schema },
    ['fundeeProjectId'],
    {
      name: 'IX_RepoDriverSplitReceivers_fundeeProjectId',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'RepoDriverSplitReceivers', schema },
    ['funderProjectId'],
    {
      name: 'IX_RepoDriverSplitReceivers_funderProjectId',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'RepoDriverSplitReceivers', schema },
    ['funderDripListId'],
    {
      name: 'IX_RepoDriverSplitReceivers_funderDripListId',
      unique: false,
    },
  );
}

async function createOwnerUpdateRequestedEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'OwnerUpdateRequestedEvents', schema },
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      forge: {
        type: DataTypes.ENUM(...Object.values(FORGES_MAP)),
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );
}

async function createOwnerUpdatedEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'OwnerUpdatedEvents', schema },
    {
      owner: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );
}

async function createGivenEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'GivenEvents', schema },
    {
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      receiver: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      erc20: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amt: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'GivenEvents', schema },
    ['accountId'],
    {
      name: 'IX_GivenEvents_accountId',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'GivenEvents', schema },
    ['receiver'],
    {
      name: 'IX_GivenEvents_receiver',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'GivenEvents', schema },
    ['erc20'],
    {
      name: 'IX_GivenEvents_erc20',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'GivenEvents', schema },
    ['transactionHash', 'logIndex'],
    {
      name: 'IX_GivenEvents_transactionHash_logIndex',
      unique: false,
    },
  );
}

async function createDripListSplitReceiversTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'DripListSplitReceivers', schema },
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      fundeeDripListId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      funderProjectId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      funderDripListId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      weight: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM(...Object.values(DependencyType)),
        allowNull: false,
      },
      blockTimestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'DripListSplitReceivers', schema },
    ['fundeeDripListId'],
    {
      name: 'IX_DripListSplitReceivers_fundeeDripListId',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'DripListSplitReceivers', schema },
    ['funderProjectId'],
    {
      name: 'IX_DripListSplitReceivers_funderProjectId',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'DripListSplitReceivers', schema },
    ['funderDripListId'],
    {
      name: 'IX_DripListSplitReceivers_funderDripListId',
      unique: false,
    },
  );
}

async function createDripListsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'DripLists', schema },
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      isValid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      ownerAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      ownerAccountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      latestVotingRoundId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      creator: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      previousOwnerAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isVisible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      lastProcessedIpfsHash: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'DripLists', schema },
    ['ownerAddress'],
    {
      name: 'IX_DripLists_ownerAddress',
      unique: false,
      where: { isValid: true },
    },
  );
}

async function createAddressDriverSplitReceiversTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'AddressDriverSplitReceivers', schema },
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      fundeeAccountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fundeeAccountAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      funderProjectId: {
        type: DataTypes.STRING,
        references: {
          model: 'GitProjects',
          key: 'id',
        },
        allowNull: true,
      },
      funderDripListId: {
        type: DataTypes.STRING,
        references: {
          model: 'DripLists',
          key: 'id',
        },
        allowNull: true,
      },
      weight: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM(...Object.values(AddressDriverSplitReceiverType)),
        allowNull: false,
      },
      blockTimestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'AddressDriverSplitReceivers', schema },
    ['fundeeAccountId'],
    {
      name: 'IX_AddressDriverSplitReceivers_fundeeAccountId',
      unique: false,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'AddressDriverSplitReceivers', schema },
    ['funderDripListId'],
    {
      name: 'IX_AddressDriverSplitReceivers_funderDripListId',
      unique: false,
    },
  );
}

async function createAccountMetadataEmittedEventsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'AccountMetadataEmittedEvents', schema },
    {
      key: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      value: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      ...COMMON_EVENT_INIT_ATTRIBUTES,
    },
  );

  await queryInterface.addIndex(
    { tableName: 'AccountMetadataEmittedEvents', schema },
    ['accountId'],
    {
      name: 'IX_AccountMetadataEmittedEvents_accountId',
      unique: false,
    },
  );
}

async function createLastIndexedBlockTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: '_LastIndexedBlock', schema },
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      blockNumber: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
    },
  );
}

async function createProjectsTable(
  queryInterface: QueryInterface,
  schema: DbSchema,
) {
  await queryInterface.createTable(
    { tableName: 'GitProjects', schema },
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      isValid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      verificationStatus: {
        type: DataTypes.ENUM(...Object.values(ProjectVerificationStatus)),
        allowNull: false,
      },
      claimedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      forge: {
        type: DataTypes.ENUM(...Object.values(FORGES_MAP)),
        allowNull: true,
      },
      ownerAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ownerAccountId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      emoji: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      avatarCid: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      color: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isVisible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      lastProcessedIpfsHash: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: literal('NOW()'),
      },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'GitProjects', schema },
    ['ownerAddress'],
    {
      name: 'IX_GitProjects_ownerAddress',
      unique: false,
      where: { isValid: true },
    },
  );

  await queryInterface.addIndex(
    { tableName: 'GitProjects', schema },
    ['verificationStatus'],
    {
      name: 'IX_GitProjects_verificationStatus',
      unique: false,
      where: { isValid: true },
    },
  );

  await queryInterface.addIndex({ tableName: 'GitProjects', schema }, ['url'], {
    name: 'IX_GitProjects_url',
    unique: false,
    where: { isValid: true },
  });
}

async function createTableIfNotExists(
  queryInterface: QueryInterface,
  schema: DbSchema,
  tableName: string,
  createFn: (queryInterface: QueryInterface, schema: DbSchema) => Promise<void>,
) {
  const tableFullName = { tableName, schema };

  const tableExists = await queryInterface
    .describeTable(tableFullName)
    .catch(() => null);
  if (!tableExists) {
    await createFn(queryInterface, schema);
  }
}

export async function down({ context: sequelize }: any): Promise<void> {
  const schema = getSchema();
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.query.dropSchema(schema);
}
