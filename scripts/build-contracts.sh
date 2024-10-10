#!/bin/bash

echo 🤓 Building contract types with Typechain
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

rm -rf ./contracts/*

echo ⚠️ Important! The code this step generates depends on the current NETWORK environment variable.
echo ⚠️ It\'s currently set to $NETWORK
echo ⚠️ If you change the NETWORK environment variable, you must re-run this script.
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

# Create a folder `CURRENT_NETWORK` in the contracts directory and copy all files from the network dir
# matching the $NETWORK env var
mkdir -p contracts/CURRENT_NETWORK
cp -r contracts/$NETWORK/* contracts/CURRENT_NETWORK/

echo "export default '$NETWORK';" > contracts/CURRENT_NETWORK/network-constant.ts

echo ✅ Done
echo
