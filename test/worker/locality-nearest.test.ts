// docs/specs/public-directory.md, "Geolocation is only a suggestion of the
// nearest locality (v2)": the pure pieces in src/core/locality/nearest.ts,
// reading the approximate location of Cloudflare's `cf` object and choosing
// the nearest place. Which locality the root suggests is tested in
// test/worker/locality-routes.test.ts, and the highlight is rendered in
// test/astro/locality-list.test.ts and test/e2e/two-localities/.
import { describe, expect, it } from "vite-plus/test";
import {
  approximateLocation,
  distanceKm,
  nearest,
  type Coordinates,
} from "../../src/core/locality/nearest.ts";

describe("Geolocation is only a suggestion of the nearest locality (v2)", () => {
  it("reads the coordinates Cloudflare attaches, which are strings", () => {
    expect(approximateLocation({ latitude: "19.83780", longitude: "-98.98130" })).toEqual({
      latitude: 19.8378,
      longitude: -98.9813,
    });
    expect(approximateLocation({ latitude: 0, longitude: 180 })).toEqual({
      latitude: 0,
      longitude: 180,
    });
  });

  it("no location: missing, half, empty, not a number or out of range", () => {
    for (const cf of [
      undefined,
      null,
      "19.8,-98.9",
      {},
      { latitude: "19.8" },
      { longitude: "-98.9" },
      { latitude: "", longitude: "" },
      { latitude: " ", longitude: "-98.9" },
      { latitude: "norte", longitude: "-98.9" },
      { latitude: "91", longitude: "0" },
      { latitude: "0", longitude: "-180.5" },
      { latitude: "NaN", longitude: "0" },
      { latitude: "Infinity", longitude: "0" },
      { latitude: null, longitude: null },
      { latitude: ["19"], longitude: ["-98"] },
    ]) {
      expect(approximateLocation(cf), JSON.stringify(cf)).toBeNull();
    }
  });

  it("measures the great-circle distance in kilometres", () => {
    const origin = { latitude: 0, longitude: 0 };
    expect(distanceKm(origin, origin)).toBe(0);
    expect(distanceKm(origin, { latitude: 0, longitude: 1 })).toBeCloseTo(111.19, 1);
    expect(distanceKm(origin, { latitude: 1, longitude: 0 })).toBeCloseTo(111.19, 1);
    expect(distanceKm(origin, { latitude: 0, longitude: 180 })).toBeCloseTo(20_015.1, 0);
    const a = { latitude: 19.5, longitude: -99.1 };
    const b = { latitude: 20.1, longitude: -98.7 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });

  type Place = { name: string; at: Coordinates | null };
  const places: Place[] = [
    { name: "far", at: { latitude: 21, longitude: -101 } },
    { name: "unknown", at: null },
    { name: "near", at: { latitude: 19.9, longitude: -99 } },
    { name: "near too", at: { latitude: 19.9, longitude: -99 } },
  ];
  const locate = (place: Place) => place.at;

  it("the nearest is the one at the shortest distance, the first on a tie", () => {
    expect(nearest({ latitude: 19.8, longitude: -98.9 }, places, locate)?.name).toBe("near");
    expect(nearest({ latitude: 21.1, longitude: -101.1 }, places, locate)?.name).toBe("far");
  });

  it("no location, or no place with coordinates, suggests nothing", () => {
    expect(nearest(null, places, locate)).toBeNull();
    expect(nearest({ latitude: 19.8, longitude: -98.9 }, [places[1]!], locate)).toBeNull();
    expect(nearest({ latitude: 19.8, longitude: -98.9 }, [], locate)).toBeNull();
  });
});
