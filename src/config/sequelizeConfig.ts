import appSettings from './appSettings';

export default {
  url: appSettings.postgresConnectionString,
  dialect: 'postgres',
};
