export function getProcessEnv(name: string) {
  if (typeof process === "undefined") return undefined;
  return process.env?.[name];
}
