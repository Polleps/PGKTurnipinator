import { CommandDefinition } from "./definitions";

/** The botadmins collection (BasicSetCache in production). */
export interface AdminLookup {
  has(userId: string): boolean;
}

export const STAFF_ONLY_MESSAGE = "This command can only be used by the staff.";

/**
 * The authority for admin-only commands. Discord's default member permissions only
 * hide commands in the picker; server admins can override them, so this is still checked.
 */
export const canRunCommand = (command: Pick<CommandDefinition, "adminOnly">, userId: string, admins: AdminLookup) =>
  !command.adminOnly || admins.has(userId);
