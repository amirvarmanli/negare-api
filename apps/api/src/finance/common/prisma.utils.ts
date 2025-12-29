export function toBigInt(value: string): bigint {
  return BigInt(value);
}

export function toBigIntString(value: bigint): string {
  return value.toString();
}
