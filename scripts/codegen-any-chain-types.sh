#!/bin/bash

echo 🤓 Generating code for contract types
echo

if [ -f .env ]; then
    source .env
else
    echo ⚠️ Warning: .env file not found. Make sure the NETWORK env var is set as expected.
fi

# Error if the NETWORK environment variable is not set
if [ -z "$NETWORK" ]; then
    echo "- 🤡 NETWORK environment variable is not set"
    exit 1
fi

rm -f ./contracts/contract-types.ts

# Array to store chain names for later use in contract-types.ts
chain_names=()

# Find all directories (representing chain names) within ./src/abi/
for chain_name in ./src/abi/*/; do
    # Remove the trailing slash from the directory name
    chain_name="${chain_name%/}"

    # Extract just the chain name from the full path
    chain_name="${chain_name##*/}"

    # Add the extracted chain name to the array
    chain_names+=("$chain_name")
done

filters_string="'filters'"

cat > ./contracts/contract-types.ts <<EOF
// This file is auto-generated, do not edit manually

$(for chain_name in "${chain_names[@]}"; do
    echo "import { Drips as ${chain_name}Drips } from './${chain_name}/';"
    echo "import { NftDriver as ${chain_name}NftDriver } from './${chain_name}/';"
    echo "import { RepoDriver as ${chain_name}RepoDriver } from './${chain_name}/';"
    echo "import { AddressDriver as ${chain_name}AddressDriver } from './${chain_name}/';"
    echo "import { TypedContractEvent as ${chain_name}TypedContractEvent } from './${chain_name}/common';"
    echo "import { TypedLogDescription as ${chain_name}TypedLogDescription } from './${chain_name}/common';"
done)

export type AnyChainDrips = \
$(echo "${chain_names[*]/%/Drips |}" | sed 's/|$//')
export type AnyChainNftDriver = \
$(echo "${chain_names[*]/%/NftDriver |}" | sed 's/|$//')
export type AnyChainRepoDriver = \
$(echo "${chain_names[*]/%/RepoDriver |}" | sed 's/|$//')
export type AnyChainAddressDriver = \
$(echo "${chain_names[*]/%/AddressDriver |}" | sed 's/|$//')

export type AnyChainDripsFilters = \
$(echo "${chain_names[*]/%/Drips[$filters_string] &}" | sed 's/&$//')
export type AnyChainNftDriverFilters = \
$(echo "${chain_names[*]/%/NftDriver[$filters_string] &}" | sed 's/&$//')
export type AnyChainRepoDriverFilters = \
$(echo "${chain_names[*]/%/RepoDriver[$filters_string] &}" | sed 's/&$//')
export type AnyChainAddressDriverFilters = \
$(echo "${chain_names[*]/%/AddressDriver[$filters_string] &}" | sed 's/&$//')

export type AnyChainTypedContractEvent = \
$(echo "${chain_names[*]/%/TypedContractEvent |}" | sed 's/|$//')
export type AnyChainTypedLogDescription<TC extends AnyChainTypedContractEvent> = \
$(echo "${chain_names[*]/%/TypedLogDescription<TC> |}" | sed 's/|$//')

import type { Provider } from 'ethers';

import { Drips__factory, NftDriver__factory, RepoDriver__factory, AddressDriver__factory } from './${NETWORK}';

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

export const getAddressDriverContract: (contractAddress: string, provider: Provider) => AnyChainAddressDriver = (contractAddress, provider) => AddressDriver__factory.connect(
    contractAddress,
    provider
);
EOF

echo ✅ All done, generated code:
cat ./contracts/contract-types.ts
