import { confirmSignIn, getCurrentUser, signIn, signOut, updatePassword } from 'aws-amplify/auth'
import { ensureAmplifyConfigured } from './storage/amplifyConfig'

export type SignInResult =
  | { status: 'signedIn' }
  | { status: 'newPasswordRequired' }
  | { status: 'error'; message: string }

export async function login(email: string, password: string): Promise<SignInResult> {
  await ensureAmplifyConfigured()
  try {
    const { isSignedIn, nextStep } = await signIn({ username: email, password })
    if (isSignedIn) return { status: 'signedIn' }
    if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      return { status: 'newPasswordRequired' }
    }
    return { status: 'error', message: `Unsupported sign-in step: ${nextStep.signInStep}` }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Sign-in failed' }
  }
}

export async function completeNewPassword(newPassword: string): Promise<SignInResult> {
  await ensureAmplifyConfigured()
  try {
    const { isSignedIn } = await confirmSignIn({ challengeResponse: newPassword })
    return isSignedIn
      ? { status: 'signedIn' }
      : { status: 'error', message: 'Password change did not complete sign-in' }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Could not set new password' }
  }
}

export async function logout() {
  await ensureAmplifyConfigured()
  await signOut()
}

export type ChangePasswordResult = { status: 'ok' } | { status: 'error'; message: string }

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  await ensureAmplifyConfigured()
  try {
    await updatePassword({ oldPassword, newPassword })
    return { status: 'ok' }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Could not change password' }
  }
}

export async function getSignedInEmail(): Promise<string | null> {
  await ensureAmplifyConfigured()
  try {
    const user = await getCurrentUser()
    return user.signInDetails?.loginId ?? user.username
  } catch {
    return null
  }
}
