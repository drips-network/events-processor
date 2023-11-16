import { JsonRpcProvider } from 'ethers';
import appSettings from '../config/appSettings';

const appProvider = new JsonRpcProvider(appSettings.rpcUrl, undefined, {
  pollingInterval: appSettings.pollingInterval,
});

export default appProvider;
