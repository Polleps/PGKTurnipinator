import { describe, expect, test } from "bun:test";
import { ButtonStyle, ComponentType } from "discord.js";
import { buildCategoryEmbed, buildRoleSelectRows } from "../src/commands/PostFlairText";
import { buildFlairButtons, formatRoleNames, knownRoles } from "../src/InteractionHandler";
import { IJoinableRole } from "../src/models/IJoinableRole";

const role = (i: number, description?: string): IJoinableRole => ({
  name: `Role ${i}`,
  category: "Regio",
  id: `10000000000000${String(i).padStart(4, "0")}`,
  description: description ?? "",
});

describe("role category embed", () => {
  test("gold embed with the category name and description", () => {
    expect(buildCategoryEmbed({ name: "Regio", description: "Waar speel je?" }).toJSON()).toEqual({
      color: 0xe5c07b,
      title: "Regio",
      description: "Waar speel je?",
    });
  });

  test("an empty description is left out (the builder rejects empty strings)", () => {
    expect(buildCategoryEmbed({ name: "Regio", description: "" }).toJSON()).toEqual({
      color: 0xe5c07b,
      title: "Regio",
      description: undefined,
    });
  });
});

describe("role select menus", () => {
  test("one multi-select per category with role options; descriptions cut to 100 chars", () => {
    const rows = buildRoleSelectRows({ name: "Regio-Noord", description: "" }, [role(1), role(2, "d".repeat(150))]);

    expect(rows.map((r) => r.toJSON())).toEqual([
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.StringSelect,
            custom_id: "roles-set-regionoord-0",
            placeholder: "Kies één of meerdere rollen",
            min_values: 1,
            max_values: 2,
            options: [
              { label: "Role 1", value: "100000000000000001" },
              { label: "Role 2", value: "100000000000000002", description: "d".repeat(100) },
            ],
          },
        ],
      },
    ]);
  });

  test("more than 25 roles are split over several menus", () => {
    const roles = Array.from({ length: 30 }, (_, i) => role(i));
    const menus = buildRoleSelectRows({ name: "Regio", description: "" }, roles).map(
      (r) => r.toJSON().components[0] as { custom_id: string; max_values: number; options: unknown[] },
    );

    expect(menus.map((m) => [m.custom_id, m.options.length, m.max_values])).toEqual([
      ["roles-set-regio-0", 25, 25],
      ["roles-set-regio-1", 5, 5],
    ]);
  });

  test("the icons category allows a single pick", () => {
    const menu = buildRoleSelectRows({ name: "Icons", description: "" }, [role(1), role(2)])[0].toJSON()
      .components[0] as { placeholder: string; max_values: number };

    expect(menu.placeholder).toBe("Kies een character icon");
    expect(menu.max_values).toBe(1);
  });

  test("a category that needs more than 5 menus is refused", () => {
    const roles = Array.from({ length: 126 }, (_, i) => role(i));
    expect(() => buildRoleSelectRows({ name: "Te veel", description: "" }, roles)).toThrow("Too many components (6)");
  });
});

describe("role selector reply", () => {
  test("add/remove buttons carry the select menu's category", () => {
    expect(buildFlairButtons("regio-0").toJSON()).toEqual({
      type: ComponentType.ActionRow,
      components: [
        { type: ComponentType.Button, custom_id: "flair-add-regio-0", label: "Toevoegen", style: ButtonStyle.Primary },
        {
          type: ComponentType.Button,
          custom_id: "flair-remove-regio-0",
          label: "Verwijderen",
          style: ButtonStyle.Secondary,
        },
      ],
    });
  });

  test("chosen role names are listed in Dutch", () => {
    expect(formatRoleNames(["A"])).toBe("**A**");
    expect(formatRoleNames(["A", "B"])).toBe("**A** en **B**");
    expect(formatRoleNames(["A", "B", "C"])).toBe("**A**, **B** en **C**");
  });
});

describe("picked roles", () => {
  test("roles deleted since the menu was posted are skipped", () => {
    const names = new Map([
      ["1", "A"],
      ["3", "C"],
    ]);
    expect(knownRoles(["1", "2", "3"], (id) => names.get(id))).toEqual([
      { id: "1", name: "A" },
      { id: "3", name: "C" },
    ]);
    expect(knownRoles(["2"], (id) => names.get(id))).toEqual([]);
  });
});
