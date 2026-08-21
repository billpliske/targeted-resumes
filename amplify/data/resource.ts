import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Mirrors src/types.ts's Application interface field-for-field. File fields
 * (jobPostingFile, resumeFile, etc.) hold the same bare filenames as local
 * mode (e.g. "resume.md") — the amplify storage adapter resolves them to
 * `applications/{identityId}/{applicationId}/{filename}` in S3.
 */
const schema = a.schema({
  Application: a
    .model({
      applicationId: a.id().required(),
      company: a.string().required(),
      role: a.string().required(),
      dateAdded: a.datetime().required(),
      jobUrl: a.string(),
      jobPostingSource: a.enum(['url', 'pasted']),
      location: a.string(),
      keywords: a.string().array(),
      status: a.enum(['not_applied', 'applied', 'interviewing', 'offer', 'rejected', 'filled']),
      fitRating: a.enum(['strong', 'good', 'partial', 'stretch']),
      fitSummary: a.string(),
      tailored: a.boolean().required(),
      jobPostingFile: a.string().required(),
      resumeFile: a.string(),
      resumePdf: a.string(),
      coverLetterFile: a.string(),
      coverLetterPdf: a.string(),
      interestFile: a.string(),
      // SHA-256 of the application's actual content files (job posting +
      // resume/cover-letter/interest markdown, when present) — lets sync
      // tell whether content genuinely changed without relying on
      // timestamps, which get bumped by irrelevant updates (a status
      // change) and are vulnerable to clock skew between machines.
      contentHash: a.string(),
    })
    .identifier(['applicationId'])
    .authorization((allow) => [allow.owner()]),

  // Single record per user; manualProjects is stored JSON-stringified since
  // Amplify's typed schema has no direct list-of-objects field without a
  // separate custom type — not worth the extra model for one settings blob.
  Settings: a
    .model({
      name: a.string(),
      resumeFilename: a.string(),
      coverLetterFilename: a.string(),
      personalProjectRepos: a.string().array(),
      manualProjectsJson: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
