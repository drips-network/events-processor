import { JsonRpcProvider, WebSocketProvider } from 'ethers';
import appSettings from '../config/appSettings';
import shouldNeverHappen from '../utils/shouldNeverHappen';

// eslint-disable-next-line no-nested-ternary
const appProvider = appSettings.rpcUrl.startsWith('https')
  ? new JsonRpcProvider(appSettings.rpcUrl, undefined, {
      pollingInterval: appSettings.pollingInterval,
    })
  : appSettings.rpcUrl.startsWith('wss')
  ? new WebSocketProvider(appSettings.rpcUrl)
  : shouldNeverHappen(`Invalid RPC URL: ${appSettings.rpcUrl}`);

export default appProvider;
