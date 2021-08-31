import { Guid, writeGuid } from "../common";

export enum UnregisterType {
  Endpoint,
  Participant,
}

export function unregisterPayload(type: UnregisterType, guid: Guid): Uint8Array {
  // Create the inlineQoS and serializedKey data
  const payload = new Uint8Array(40);
  const payloadView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const byte = type === UnregisterType.Endpoint ? 0x5a : 0x50;
  payload.set(
    [
      0x71, // PID_STATUS_INFO
      0x00, // PID_STATUS_INFO
      0x04, // parameterLength = 4
      0x00, // parameterLength
      0x00, // flags
      0x00, // flags
      0x00, // flags
      0x03, // flags = Unregistered, Disposed
      0x01, // PID_SENTINEL
      0x00, // PID_SENTINEL
      0x00, // PID_SENTINEL
      0x00, // PID_SENTINEL
    ],
    0,
  );
  payload.set(
    [
      0x00, // PL_CDR_LE
      0x03, // PL_CDR_LE
      0x00, // cdrOptions
      0x00, // cdrOptions
      byte, // PID_ENDPOINT_GUID or PID_PARTICIPANT_GUID
      0x00, // PID_ENDPOINT_GUID or PID_PARTICIPANT_GUID
      0x10, // parameterLength = 16
      0x00, // parameterLength
    ],
    12,
  );
  writeGuid(guid, payloadView, 20);
  payload.set([0x01, 0x00, 0x00, 0x00], 36); // PID_SENTINEL
  return payload;
}
