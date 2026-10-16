// docs/specs/public-directory.md, "A zone whose name repeats in its locality
// is shown with its settlement type (v2)": the display names of the zones
// (src/core/catalogue/zone-names.ts), pure, and over the zones of Tizayuca
// that the migrations leave (src/core/catalogue/pages.ts). Where the pages
// use them is tested in test/worker/listings.test.ts and end to end.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";
import { localityZoneNames } from "../../src/core/catalogue/pages.ts";
import {
  sentenceCase,
  type TypedZone,
  withZoneName,
  zoneDisplayNames,
} from "../../src/core/catalogue/zone-names.ts";
import { zones } from "../../src/core/db/schema/index.ts";
import { db } from "./fixtures.ts";

const zone = (type: string, name: string, slug: string): TypedZone => ({ type, name, slug });

describe("A zone whose name repeats in its locality is shown with its settlement type (v2)", () => {
  // Scenario: two zones with the same name
  it("two zones of a locality with the same name are each shown with their type", () => {
    const names = zoneDisplayNames(
      [
        zone("Colonia", "El Carmen", "colonia-el-carmen"),
        zone("Fraccionamiento", "El Carmen", "fraccionamiento-el-carmen"),
        zone("Barrio", "Huicalco", "huicalco"),
      ],
      "Tizayuca",
    );

    expect(Object.fromEntries(names)).toEqual({
      "colonia-el-carmen": "El Carmen (Colonia)",
      "fraccionamiento-el-carmen": "El Carmen (Fraccionamiento)",
      huicalco: "Huicalco",
    });
  });

  // Scenario: a zone named like its municipality
  it("a zone named like its locality is shown with its type, even alone", () => {
    const names = zoneDisplayNames(
      [
        zone("Zona industrial", "Tizayuca", "zona-industrial-tizayuca"),
        zone("Colonia", "Tizayuca Centro", "tizayuca-centro"),
      ],
      "Tizayuca",
    );

    expect(Object.fromEntries(names)).toEqual({
      "zona-industrial-tizayuca": "Tizayuca (Zona industrial)",
      "tizayuca-centro": "Tizayuca Centro",
    });
  });

  it("names are compared ignoring case, accents and punctuation", () => {
    const names = zoneDisplayNames(
      [
        zone("Colonia", "La Purísima", "colonia-la-purisima"),
        zone("Barrio", "la purisima", "barrio-la-purisima"),
        zone("Pueblo", "Pueblo-Uno", "pueblo-uno"),
      ],
      "Pueblo Uno",
    );

    expect([...names.values()]).toEqual([
      "La Purísima (Colonia)",
      "la purisima (Barrio)",
      "Pueblo-Uno (Pueblo)",
    ]);
  });

  it("the type is written in sentence case, and the name trimmed", () => {
    expect(sentenceCase("ZONA INDUSTRIAL")).toBe("Zona industrial");
    expect(sentenceCase(" unidad  habitacional ")).toBe("Unidad habitacional");
    expect(sentenceCase("Ranchería")).toBe("Ranchería");
    expect(
      Object.fromEntries(
        zoneDisplayNames(
          [zone("COLONIA", " Centro ", "colonia-centro"), zone("barrio", "Centro", "centro")],
          "Pueblo",
        ),
      ),
    ).toEqual({ "colonia-centro": "Centro (Colonia)", centro: "Centro (Barrio)" });
  });

  // Scenario: a renamed zone
  it("decided from the data: a zone renamed like another makes both show their type", () => {
    const before = [zone("Colonia", "Norte", "norte"), zone("Colonia", "Sur", "sur")];
    const after = [zone("Colonia", "Norte", "norte"), zone("Fraccionamiento", "Norte", "sur")];

    expect([...zoneDisplayNames(before, "Pueblo").values()]).toEqual(["Norte", "Sur"]);
    expect([...zoneDisplayNames(after, "Pueblo").values()]).toEqual([
      "Norte (Colonia)",
      "Norte (Fraccionamiento)",
    ]);
  });

  it('the free text of a zone "Otra" is shown as written; a catalogue zone takes its display name', () => {
    const names = zoneDisplayNames([zone("Colonia", "Tizayuca", "colonia-tizayuca")], "Tizayuca");

    expect(withZoneName({ zoneSlug: null, zoneName: "Tizayuca" }, names)).toEqual({
      zoneSlug: null,
      zoneName: "Tizayuca",
    });
    expect(
      withZoneName({ zoneSlug: "colonia-tizayuca", zoneName: "Tizayuca", id: 1 }, names),
    ).toEqual({ zoneSlug: "colonia-tizayuca", zoneName: "Tizayuca (Colonia)", id: 1 });
  });

  it("in Tizayuca, exactly the four names SEPOMEX lists twice are shown with their type", async () => {
    const names = await db((tx) => localityZoneNames(tx, { code: "13069", name: "Tizayuca" }));
    const raw = new Map(
      (
        await db((tx) =>
          tx
            .select({ slug: zones.slug, name: zones.name })
            .from(zones)
            .where(eq(zones.localityCode, "13069")),
        )
      ).map(({ slug, name }) => [slug, name]),
    );
    const typed = [...names].filter(([slug, name]) => name !== raw.get(slug));

    expect(names.size).toBe(105);
    expect(Object.fromEntries(typed)).toEqual({
      "colonia-el-carmen": "El Carmen (Colonia)",
      "fraccionamiento-el-carmen": "El Carmen (Fraccionamiento)",
      "fraccionamiento-el-manantial": "El Manantial (Fraccionamiento)",
      "rancho-el-manantial": "El Manantial (Rancho)",
      "pueblo-el-chopo": "El Chopo (Pueblo)",
      "rancho-el-chopo": "El Chopo (Rancho)",
      "unidad-habitacional-tizayuca": "Tizayuca (Unidad habitacional)",
      "zona-industrial-tizayuca": "Tizayuca (Zona industrial)",
    });
    expect(names.get("haciendas-de-tizayuca")).toBe("Haciendas de Tizayuca");
    // A name with brackets of its own keeps them, and gets no type.
    expect(names.get("ignacio-zaragoza-mogotes")).toBe("Ignacio Zaragoza (Mogotes)");
  });
});
