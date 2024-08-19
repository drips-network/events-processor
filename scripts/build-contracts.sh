#!/bin/bash

echo ⚠️ Important! The code this step generates depends on the current NETWORK environment variable.
echo ⚠️ It\'s currently set to $NETWORK
echo ⚠️ If you change the NETWORK environment variable, you must re-run this script.
echo

echo 🤓 Building contract types with Typechain
echo

# Find all directories (representing chain names) within ./src/abi/
for chain_name in ./src/abi/*/; do
    # Remove the trailing slash from the directory name
    chain_name="${chain_name%/}"

    # Extract just the chain name from the full path
    chain_name="${chain_name##*/}"

    echo "Building Typechain artifacts for $chain_name"

    # Execute the typechain command from the project root
    typechain --target=ethers-v6 --out-dir "contracts/$chain_name" "src/abi/$chain_name/**.json"
done

echo

source .env

# Create a folder `CURRENT_NETWORK` in the contracts directory and copy all files from the network dir
# matching the $NETWORK env var
mkdir -p contracts/CURRENT_NETWORK
cp -r contracts/$NETWORK/* contracts/CURRENT_NETWORK/

echo ✅ Done
echo
