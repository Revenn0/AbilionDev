import { userCan, profilesForUser } from "./access"
import type { Permission } from "./platform"
import { useStore } from "./store"

export function useAccess() {
  const user = useStore().state.user
  return {
    user,
    profiles: profilesForUser(user),
    can: (permission: Permission) => userCan(user, permission),
  }
}
