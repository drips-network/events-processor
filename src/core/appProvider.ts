import { JsonRpcProvider, WebSocketProvider } from 'ethers';
import appSettings from '../config/appSettings';
import unreachableError from '../utils/unreachableError';

// eslint-disable-next-line no-nested-ternary
const appProvider = appSettings.rpcUrl.startsWith('http')
  ? new JsonRpcProvider(appSettings.rpcUrl, undefined, {
      pollingInterval: appSettings.pollingInterval,
    })
  : appSettings.rpcUrl.startsWith('wss')
    ? new WebSocketProvider(appSettings.rpcUrl)
    : unreachableError(`Invalid RPC URL: ${appSettings.rpcUrl}`);

export default appProvider;
