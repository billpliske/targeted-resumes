import { defineAuth } from '@aws-amplify/backend';

/**
 * Public self-signup is disabled in amplify/backend.ts (AllowAdminCreateUserOnly).
 * Users are created via `npx ampx sandbox` admin tooling or the Cognito console, not this app.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
