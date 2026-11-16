import { describe, expect, test } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import { commandDefinitions, commandsJSON, findCommand } from "../src/commands/definitions";
import { buildHelpText } from "../src/Help";
import { hasNeeRole } from "../src/triggers/NeeTrigger";

describe("slash command definitions", () => {
  test("/delete-tournament has a required, autocompleted slug option", () => {
    const json = commandsJSON().find((c) => c.name === "delete-tournament");
    expect(json?.options).toEqual([
      expect.objectContaining({ name: "slug", type: 3, required: true, autocomplete: true }),
    ]);
  });

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
      fixbot: manageGuild,
      "delete-tournament": manageGuild,
    });
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
    expect(buildHelpText(commandDefinitions, false, "delete-tournament")).toBe("delete-tournament is not a command.");
    expect(buildHelpText(commandDefinitions, true, "/delete-tournament")).toContain(
      "**Usage**: Type `/delete-tournament slug:`",
    );
  });
});

describe("NEE role members (blocked from commands, as in v13)", () => {
  const nee = ["300000000000000001"];

  test("a member with a NEE role is blocked", () => {
    expect(hasNeeRole(["1", "300000000000000001"], nee)).toBe(true);
    expect(hasNeeRole(new Map([["300000000000000001", {}]]).keys(), nee)).toBe(true);
  });

  test("other members, or no NEE roles configured, are not", () => {
    expect(hasNeeRole(["1", "2"], nee)).toBe(false);
    expect(hasNeeRole([], nee)).toBe(false);
    expect(hasNeeRole(["300000000000000001"], [])).toBe(false);
  });
});
