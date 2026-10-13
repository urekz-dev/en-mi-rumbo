import { describe, expect, it } from "vite-plus/test";
import { assertSafeConnectionString, isLocalConnectionString } from "../../src/core/db/url.ts";

// Spec "Ninguna conexión a la base sale de la máquina sin cifrar" (deployment).
describe("No database connection leaves the machine unencrypted", () => {
  it("remote address without encryption", () => {
    const url = "postgres://u:s3cret@ep-x.neon.tech/db";
    expect(() => assertSafeConnectionString(url)).toThrow(/sslmode=verify-full/);
    expect(() => assertSafeConnectionString(url + "?sslmode=require")).toThrow();
    try {
      assertSafeConnectionString(url);
    } catch (error) {
      expect(String(error)).not.toContain("s3cret");
    }
  });

  it("remote address with certificate verification", () => {
    expect(() =>
      assertSafeConnectionString("postgres://u:p@ep-x.neon.tech/db?sslmode=verify-full"),
    ).not.toThrow();
  });

  it("the address disguised as local", () => {
    const url = "postgres://u:p@localhost/db?host=evil.example.com";
    expect(isLocalConnectionString(url)).toBe(false);
    expect(() => assertSafeConnectionString(url)).toThrow();
  });

  it("the local database does not need encryption", () => {
    expect(() =>
      assertSafeConnectionString("postgres://enmirumbo:enmirumbo@localhost:5432/enmirumbo"),
    ).not.toThrow();
    expect(() => assertSafeConnectionString("postgres://u:p@127.0.0.1/db")).not.toThrow();
  });
});
