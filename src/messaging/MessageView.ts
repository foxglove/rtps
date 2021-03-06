import { Time } from "@foxglove/rostime";

import {
  GuidPrefix,
  guidPrefixFromData,
  SubMessageId,
  VendorId,
  toHex,
  ProtocolVersion,
} from "../common";
import { SubMessageView } from "./SubMessageView";
import {
  AckNackView,
  DataFragView,
  DataMsgView,
  GapView,
  HeartbeatFragView,
  HeartbeatView,
  InfoDstView,
  InfoTsView,
  NackFragView,
  PadView,
} from "./submessages";

export class MessageView {
  readonly data: Readonly<Uint8Array>;
  readonly view: Readonly<DataView>;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // Min length of a message is 20 bytes
    if (data.length < 20) {
      throw new Error(`invalid RTPS message, expected 20+ bytes but got ${data.length}`);
    }

    // Check if the message starts with "RTPS"
    const magic = this.view.getUint32(0, false);
    if (magic !== 0x52545053) {
      const badMagic = toHex(this.data.slice(0, 4));
      throw new Error(`invalid magic bytes, expected RTPS but got "${badMagic}"`);
    }
  }

  get protocolVersion(): ProtocolVersion {
    return { major: this.view.getUint8(4), minor: this.view.getUint8(5) };
  }

  get vendorId(): VendorId {
    return this.view.getUint16(6, false);
  }

  get guidPrefix(): GuidPrefix {
    return guidPrefixFromData(this.view, 8);
  }

  subMessages(): SubMessageView[] {
    const views: SubMessageView[] = [];
    let offset = 20;

    let curTimestamp: Time | undefined;
    let curGuidPrefix: GuidPrefix | undefined;

    while (offset < this.view.byteLength) {
      const subMessageId = this.view.getUint8(offset) as SubMessageId;
      const subMessageView = getSubMessageView(
        subMessageId,
        this.data,
        this.view,
        offset,
        curTimestamp,
        curGuidPrefix,
      );

      // INFO_TS timestamp and INFO_DST guidPrefix are assigned to all
      // subsequent submessages
      if (subMessageId === SubMessageId.INFO_TS) {
        curTimestamp = (subMessageView as InfoTsView).timestamp;
      } else if (subMessageId === SubMessageId.INFO_DST) {
        curGuidPrefix = (subMessageView as InfoDstView).guidPrefix;
      }

      offset += 4 + subMessageView.octetsToNextHeader;
      views.push(subMessageView);
    }

    return views;
  }
}

function getSubMessageView(
  id: SubMessageId,
  data: Uint8Array,
  view: DataView,
  offset: number,
  timestamp: Time | undefined,
  guidPrefix: GuidPrefix | undefined,
): SubMessageView {
  switch (id) {
    case SubMessageId.PAD:
      return new PadView(data, view, offset);
    case SubMessageId.ACKNACK:
      return new AckNackView(data, view, offset, guidPrefix);
    case SubMessageId.HEARTBEAT:
      return new HeartbeatView(data, view, offset, guidPrefix);
    case SubMessageId.GAP:
      return new GapView(data, view, offset);
    case SubMessageId.INFO_TS:
      return new InfoTsView(data, view, offset);
    case SubMessageId.INFO_DST:
      return new InfoDstView(data, view, offset);
    case SubMessageId.NACK_FRAG:
      return new NackFragView(data, view, offset, guidPrefix);
    case SubMessageId.HEARTBEAT_FRAG:
      return new HeartbeatFragView(data, view, offset, guidPrefix);
    case SubMessageId.DATA:
      return new DataMsgView(data, view, offset, guidPrefix, timestamp);
    case SubMessageId.DATA_FRAG:
      return new DataFragView(data, view, offset, guidPrefix, timestamp);
    case SubMessageId.SEC_BODY:
      // return new SecBodyView(data, view, offset, guidPrefix, timestamp);
      return new SubMessageView(data, view, offset, guidPrefix, timestamp);
    case SubMessageId.SEC_PREFIX:
      // return new SecPrefixView(data, view, offset, guidPrefix, timestamp);
      return new SubMessageView(data, view, offset, guidPrefix, timestamp);
    case SubMessageId.SEC_POSTFIX:
      // return new SecPostfixView(data, view, offset, guidPrefix, timestamp);
      return new SubMessageView(data, view, offset, guidPrefix, timestamp);
    case SubMessageId.SRTPS_PREFIX:
      // return new SrtpsPrefixView(data, view, offset, guidPrefix, timestamp);
      return new SubMessageView(data, view, offset, guidPrefix, timestamp);
    case SubMessageId.SRTPS_POSTFIX:
      // return new SrtpsPostfixView(data, view, offset, guidPrefix, timestamp);
      return new SubMessageView(data, view, offset, guidPrefix, timestamp);
    default:
      return new SubMessageView(data, view, offset, guidPrefix, timestamp);
  }
}
