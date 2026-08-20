import { defineStorage } from '@aws-amplify/backend';

/**
 * {entity_id} resolves to the signed-in user's Cognito identity id, so each
 * user's application documents/PDFs live under their own path automatically.
 */
export const storage = defineStorage({
  name: 'targetedResumesStorage',
  access: (allow) => ({
    'applications/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
    'settings/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
  }),
});
