import { BuiltinEndpointSet } from "./enums";

export function hasBuiltinEndpoint(set: BuiltinEndpointSet, flag: BuiltinEndpointSet): boolean {
  return (set & flag) === flag;
}
