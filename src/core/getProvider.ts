import type { Provider } from 'ethers';
import { FetchRequest, JsonRpcProvider, WebSocketProvider } from 'ethers';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import appSettings from '../config/appSettings';

let providerInstance: Provider | null = null;

export default function getProvider(): Provider {
  if (!providerInstance) {
    const { rpcUrl, glifToken, pollingInterval } = appSettings;

    if (rpcUrl.includes('node.glif.io')) {
      const fetchRequest = new FetchRequest(rpcUrl);

      fetchRequest.method = 'POST';
      fetchRequest.setHeader('Content-Type', 'application/json');
      fetchRequest.setHeader('Authorization', `Bearer ${glifToken}`);

      providerInstance = new JsonRpcProvider(fetchRequest, undefined, {
        pollingInterval,
      });
    } else if (rpcUrl.startsWith('http')) {
      providerInstance = new JsonRpcProvider(rpcUrl, undefined, {
        pollingInterval,
      });
    } else if (rpcUrl.startsWith('wss')) {
      providerInstance = new WebSocketProvider(rpcUrl);
    } else {
      shouldNeverHappen(`Invalid RPC URL: ${rpcUrl}`);
    }
  }

  return providerInstance;
}
