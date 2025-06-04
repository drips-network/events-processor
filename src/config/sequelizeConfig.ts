/* eslint-disable import/no-import-module-exports */
import appSettings from './appSettings';

const config = {
  url: appSettings.postgresConnectionString,
  dialect: 'postgres',
  define: {
    schema: appSettings.network,
  },
};

module.exports = config;
