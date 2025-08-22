/* eslint-disable no-console */
import 'dotenv/config';
import fs from 'fs';

if (!process.env.NETWORK) {
  console.error('- 🤡 NETWORK environment variable is not set');
  process.exit(1);
}

function cleanup() {
  console.log(
    '- 🧹 Cleaning up prior types in ./contracts/contract-types.ts...',
  );

  // delete ./contracts/contract-types.ts if exists
  if (fs.existsSync('./contracts/contract-types.ts')) {
    fs.unlinkSync('./contracts/contract-types.ts');
  }
}

function getChainNames() {
  try {
    const entries = fs.readdirSync('./src/abi/', { withFileTypes: true });
    const folderNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    return folderNames;
  } catch (err) {
    console.error('Error reading directory:', err);
    throw err;
  }
}

function generateTypeImports(chainNames: string[]) {
  let result = '';

  for (const chainName of chainNames) {
    result += `
import { Drips as ${chainName}Drips } from './${chainName}/';
import { NftDriver as ${chainName}NftDriver } from './${chainName}/';
import { RepoDriver as ${chainName}RepoDriver } from './${chainName}/';
import { RepoSubAccountDriver as ${chainName}RepoSubAccountDriver } from './${chainName}/';
import { AddressDriver as ${chainName}AddressDriver } from './${chainName}/';
import { ImmutableSplitsDriver as ${chainName}ImmutableSplitsDriver } from './${chainName}/';
import { TypedContractEvent as ${chainName}TypedContractEvent } from './${chainName}/common';
import { TypedLogDescription as ${chainName}TypedLogDescription } from './${chainName}/common';`;
  }

  return result;
}

function generateAnyChainTypes(chainNames: string[]) {
  const typeDefinitions = `
export type AnyChainDrips = ${chainNames.map((name) => `${name}Drips`).join(' | ')};
export type AnyChainNftDriver = ${chainNames.map((name) => `${name}NftDriver`).join(' | ')};
export type AnyChainRepoDriver = ${chainNames.map((name) => `${name}RepoDriver`).join(' | ')};
export type AnyChainRepoSubAccountDriver = ${chainNames.map((name) => `${name}RepoSubAccountDriver`).join(' | ')};
export type AnyChainAddressDriver = ${chainNames.map((name) => `${name}AddressDriver`).join(' | ')};
export type AnyChainImmutableSplitsDriver = ${chainNames.map((name) => `${name}ImmutableSplitsDriver`).join(' | ')};

export type AnyChainDripsFilters = ${chainNames.map((name) => `${name}Drips['filters']`).join(' & ')};
export type AnyChainNftDriverFilters = ${chainNames.map((name) => `${name}NftDriver['filters']`).join(' & ')};
export type AnyChainRepoDriverFilters = ${chainNames.map((name) => `${name}RepoDriver['filters']`).join(' & ')};
export type AnyChainRepoSubAccountDriverFilters = ${chainNames.map((name) => `${name}RepoSubAccountDriver['filters']`).join(' & ')};
export type AnyChainAddressDriverFilters = ${chainNames.map((name) => `${name}AddressDriver['filters']`).join(' & ')};
export type AnyChainImmutableSplitsDriverFilters = ${chainNames.map((name) => `${name}ImmutableSplitsDriver['filters']`).join(' & ')};

export type AnyChainTypedContractEvent = ${chainNames.map((name) => `${name}TypedContractEvent`).join(' | ')};
export type AnyChainTypedLogDescription<TC extends AnyChainTypedContractEvent> = ${chainNames.map((name) => `${name}TypedLogDescription<TC>`).join(' | ')};`;

  return typeDefinitions;
}

function generateContractGetters() {
  return `
import type { Provider } from 'ethers';

import { Drips__factory, NftDriver__factory, RepoDriver__factory, AddressDriver__factory, ImmutableSplitsDriver__factory, RepoSubAccountDriver__factory } from './${process.env.NETWORK}';

export const getDripsContract: (contractAddress: string, provider: Provider) => AnyChainDrips = (contractAddress, provider) => Drips__factory.connect(
    contractAddress,
    provider
);

export const getNftDriverContract: (contractAddress: string, provider: Provider) => AnyChainNftDriver = (contractAddress, provider) => NftDriver__factory.connect(
    contractAddress,
    provider
);

export const getRepoDriverContract: (contractAddress: string, provider: Provider) => AnyChainRepoDriver = (contractAddress, provider) => RepoDriver__factory.connect(
    contractAddress,
    provider
);

export const getRepoSubAccountDriverContract: (contractAddress: string, provider: Provider) => AnyChainRepoSubAccountDriver = (contractAddress, provider) => RepoSubAccountDriver__factory.connect(
    contractAddress,
    provider
);

export const getAddressDriverContract: (contractAddress: string, provider: Provider) => AnyChainAddressDriver = (contractAddress, provider) => AddressDriver__factory.connect(
    contractAddress,
    provider
);

export const getImmutableSplitsDriverContract: (contractAddress: string, provider: Provider) => AnyChainImmutableSplitsDriver = (contractAddress, provider) => ImmutableSplitsDriver__factory.connect(
  contractAddress,
  provider
);`;
}

async function main() {
  console.log('🤓 Generating code for contract types...');

  cleanup();

  const chainNames = getChainNames();

  const typeImportsString = generateTypeImports(chainNames);
  const anyChainTypes = generateAnyChainTypes(chainNames);
  const contractGetters = generateContractGetters();

  const result = `// This file is auto-generated, do not edit manually
${typeImportsString}
${anyChainTypes}
${contractGetters}
  `;

  fs.writeFileSync('./contracts/contract-types.ts', result);

  console.log(
    '- ✅ All done, generated code written to ./contracts/contract-types.ts:\n',
  );
  console.log(`\x1b[32m${result}\x1b[0m`);
}

main();
