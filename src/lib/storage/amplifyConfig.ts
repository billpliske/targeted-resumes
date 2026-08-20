import { Amplify } from 'aws-amplify'

let configured: Promise<void> | null = null

// Fetched as a static asset (like every other file in public/) rather than
// bundled — amplify_outputs.json doesn't exist for forkers who never run
// `ampx sandbox`, and a static import would break their `npm run build`.
export function ensureAmplifyConfigured(): Promise<void> {
  if (!configured) {
    configured = fetch('/amplify_outputs.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            'Cloud storage mode is enabled but public/amplify_outputs.json was not found. Run `npx ampx sandbox --once --outputs-out-dir public` first.',
          )
        }
        return res.json()
      })
      .then((outputs) => {
        Amplify.configure(outputs)
      })
  }
  return configured
}
