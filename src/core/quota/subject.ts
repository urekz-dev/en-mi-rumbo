// What a per-IP quota counts (docs/specs/deployment.md, "Anti-abuse counters
// live in a Durable Object and never in PostgreSQL (v2)"). An IPv4 address is
// counted as is. An IPv6 address is counted by its first 64 bits: a home or a
// phone receives a whole /64 and may change the rest at will, so counting the
// full address would give one person as many quotas as addresses it makes up.
// A loopback address is this machine: Cloudflare never writes one, and
// locally Miniflare gives it to every request, so it is not counted, and
// development and the end-to-end tests are never held back (the tests of the
// quota send an address of their own). The subject is used in memory only, to
// make a code with a secret key, and never stored or logged. Everything here
// is pure.

const IPV4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEXTET = /^[0-9a-f]{1,4}$/;

/** The sixteen-bit groups of an IPv6 address, or null when it is not one. */
function ipv6Groups(address: string): number[] | null {
  let text = address.toLowerCase();
  // An IPv4 address written in the last 32 bits (`::ffff:192.0.2.1`).
  const embedded = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (embedded) {
    const [, head = "", ipv4 = ""] = embedded;
    if (!IPV4.test(ipv4)) return null;
    const [a = 0, b = 0, c = 0, d = 0] = ipv4.split(".").map(Number);
    text = `${head}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  // Without "::" there are eight groups; with it, it stands for at least one.
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [
    ...head,
    ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => "0"),
    ...tail,
  ];
  if (!groups.every((group) => HEXTET.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

/** An IPv4 address, unless it is a loopback one (127.0.0.0/8). */
function ipv4Subject(address: string): string | null {
  return address.startsWith("127.") ? null : address;
}

/**
 * The subject a quota counts for the address of a request: the IPv4 address,
 * the /64 of an IPv6 address (an IPv4 address mapped into IPv6 is its IPv4
 * address), or null when there is no address or it is a loopback one, and
 * then nothing is counted. Anything else that arrives is counted as written,
 * lowercased.
 */
export function quotaSubject(address: string | null): string | null {
  // A zone index (`fe80::1%eth0`) names the interface, not the address.
  const text = (address ?? "").trim().replace(/%.*$/, "");
  if (text === "") return null;
  if (IPV4.test(text)) return ipv4Subject(text);
  const groups = ipv6Groups(text);
  if (groups === null) return text.toLowerCase();
  const [g0, g1, g2, g3, g4, g5, g6 = 0, g7 = 0] = groups;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    if (g5 === 0xffff) return ipv4Subject([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff].join("."));
    // ::1
    if (g5 === 0 && g6 === 0 && g7 === 1) return null;
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}
