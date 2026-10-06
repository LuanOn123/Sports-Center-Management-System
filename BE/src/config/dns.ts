import dns from "node:dns";
// Optional process-local resolver override for environments whose default DNS
// cannot resolve MongoDB Atlas SRV records. Never changes Windows network settings.
export function configureDns() {
  const servers = process.env.DNS_SERVERS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (servers?.length) dns.setServers(servers);
}
