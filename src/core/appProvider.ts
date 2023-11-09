import { JsonRpcProvider } from 'ethers';
import appSettings from '../config/appSettings';

const appProvider = new JsonRpcProvider(appSettings.rpcUrl, undefined, {
  pollingInterval: 5000,
});

export default appProvider;
