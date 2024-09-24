import { FetchRequest } from 'ethers';
import appSettings from '../config/appSettings';
import { FailoverJsonRpcProvider } from './FailoverProvider';

let providerInstance: FailoverJsonRpcProvider;

export default function getProvider(): FailoverJsonRpcProvider {
  if (!providerInstance) {
    const {
      primaryRpcUrl,
      primaryRpcAccessToken,
      fallbackRpcUrl,
      fallbackRpcAccessToken,
      pollingInterval,
    } = appSettings;
    if (
      !primaryRpcUrl?.startsWith('http') ||
      (!fallbackRpcUrl && fallbackRpcUrl?.startsWith('http'))
    ) {
      throw new Error('Unsupported RPC URL protocol.');
    }

    const primaryEndpoint = primaryRpcAccessToken
      ? createAuthFetchRequest(primaryRpcUrl, primaryRpcAccessToken)
      : primaryRpcUrl;

    const rpcEndpoints = [primaryEndpoint];

    if (fallbackRpcUrl) {
      const fallbackEndpoint = fallbackRpcAccessToken
        ? createAuthFetchRequest(fallbackRpcUrl, fallbackRpcAccessToken)
        : fallbackRpcUrl;
      rpcEndpoints.push(fallbackEndpoint);
    }

    providerInstance = new FailoverJsonRpcProvider(rpcEndpoints, undefined, {
      pollingInterval,
    });
  }

  return providerInstance;
}

function createAuthFetchRequest(rpcUrl: string, token: string): FetchRequest {
  const fetchRequest = new FetchRequest(rpcUrl);
  fetchRequest.method = 'POST';
  fetchRequest.setHeader('Content-Type', 'application/json');
  fetchRequest.setHeader('Authorization', `Bearer ${token}`);
  return fetchRequest;
}
