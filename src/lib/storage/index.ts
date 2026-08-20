import { amplifyAdapter } from './amplifyAdapter'
import { localAdapter } from './localAdapter'
import type { StorageAdapter } from './types'

export const isCloudMode = import.meta.env.VITE_STORAGE_BACKEND === 'amplify'

export const storage: StorageAdapter = isCloudMode ? amplifyAdapter : localAdapter

export type {
  CheckListingResult,
  DocKind,
  ManualProject,
  SettingsData,
  SettingsResult,
  StorageAdapter,
} from './types'
