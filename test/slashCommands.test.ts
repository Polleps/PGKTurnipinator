import { describe, expect, test } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import { commandDefinitions, commandsJSON, findCommand } from "../src/commands/definitions";
import { canRunCommand } from "../src/commands/permissions";
import { buildHelpText } from "../src/Help";

const ADMIN_ID = "200000000000000001";
const admins = new Set([ADMIN_ID]);

describe("slash command definitions", () => {
  test("registration JSON", () => {
    expect(commandsJSON()).toMatchSnapshot();
  });

  test("admin-only commands default to Manage Server; public ones to everyone", () => {
    const perms = Object.fromEntries(commandsJSON().map((c) => [c.name, c.default_member_permissions]));
    const manageGuild = PermissionFlagsBits.ManageGuild.toString();

    expect(perms).toEqual({
      ping: undefined,
      help: undefined,
      postflairtext: manageGuild,
      reloadcache: manageGuild,
      fixbot: manageGuild,
    });
  });
});

describe("permission gating (botadmins is the authority)", () => {
  test("public commands run for anyone", () => {
    expect(canRunCommand(findCommand("ping")!, "123", admins)).toBe(true);
  });

  test("admin-only commands run for bot admins only", () => {
    for (const name of ["postflairtext", "reloadcache", "fixbot"]) {
      expect(canRunCommand(findCommand(name)!, ADMIN_ID, admins)).toBe(true);
      // A member Discord lets through (Manage Server, or a permission override) is still refused.
      expect(canRunCommand(findCommand(name)!, "123", admins)).toBe(false);
    }
  });
});

describe("/help", () => {
  test("lists the public commands", () => {
    expect(buildHelpText(commandDefinitions, false)).toBe(
      "**Command List**\n`/ping`: It's just ping\n`/help`: Lists the bot's commands.",
    );
  });

  test("details of a public command, with or without the slash", () => {
    expect(buildHelpText(commandDefinitions, false, "/Ping")).toBe(
      "**ping**:\n**Description**: It's just ping\n**Usage**: Type `/ping`",
    );
  });

  test("admin-only commands only exist for admins", () => {
    expect(buildHelpText(commandDefinitions, false, "fixbot")).toBe("fixbot is not a command.");
    expect(buildHelpText(commandDefinitions, true, "fixbot")).toContain("**Description**: Restarts the bot.");
    expect(buildHelpText(commandDefinitions, true, "nope")).toBe("nope is not a command.");
  });
});
