import { z } from 'zod';

const gitHubSourceSchema = z.object({
  forge: z.literal('github'),
  repoName: z.string(),
  ownerName: z.string(),
  url: z.string(),
});

const sourceSchema = gitHubSourceSchema;

export default sourceSchema;
