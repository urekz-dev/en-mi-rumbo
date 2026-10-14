// The identifier of a business: ten random characters from lowercase letters
// and digits, without the ones people confuse (0/o, 1/l/i). It is the stable
// part of the card's URL, `/{estado}/{municipio}/negocio/<slug>-<id>`, so it
// has no hyphen, never derives from the name and reveals nothing about how
// many businesses exist. 31^10 is about 8 × 10^14 identifiers; the primary
// key still rejects a repeat, and the caller generates another.
import { customAlphabet } from "nanoid";

export const BUSINESS_ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const BUSINESS_ID_LENGTH = 10;
export const BUSINESS_ID_PATTERN = `^[${BUSINESS_ID_ALPHABET}]{${BUSINESS_ID_LENGTH}}$`;

export const newBusinessId: () => string = customAlphabet(BUSINESS_ID_ALPHABET, BUSINESS_ID_LENGTH);

const businessIdRegExp = new RegExp(BUSINESS_ID_PATTERN);

/** Whether a string has the shape of a business identifier. */
export function isBusinessId(value: string): boolean {
  return businessIdRegExp.test(value);
}
