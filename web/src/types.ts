/** Represents a chat entry in the sidebar */
export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: number | string | Date;
  unreadCount: number;
}

/** Raw chat object returned from the WAHA API */
export interface WahaChat {
  id: string | { _serialized?: string; user?: string };
  chatId?: string;
  name?: string;
  unreadCount?: number;
  lastMessage?: {
    body?: string;
    timestamp?: number | string;
  };
  lastMessageText?: string;
}

/** Message data sub-object (_data field) */
export interface MessageData {
  notifyName?: string;
  mimetype?: string;
  [key: string]: unknown;
}

/** Media attachment info */
export interface MediaInfo {
  url: string;
  filename?: string;
}

/** A WhatsApp message */
export interface Message {
  _data?: MessageData;
  _serialized?: string | { _serialized?: string; user?: string };
  id: string | { _serialized?: string; user?: string };
  body?: string;
  text?: string;
  from?: string;
  to?: string;
  fromMe?: boolean;
  sender?: string;
  timestamp: number | string;
  status?: string;
  ack?: number;
  hasMedia?: boolean;
  media?: MediaInfo;
  chatId?: string;
  chat?: { id: string };
  participant?: string;
}

/** Temporary message used for optimistic UI updates */
export interface TempMessage extends Message {
  status: string;
}

/** File-sending temporary message */
export interface TempFileMessage extends TempMessage {
  _data: MessageData;
  hasMedia: true;
  media: MediaInfo;
}

/** WAHA version response */
export interface VersionResponse {
  version?: string;
}

/** WAHA user info (getMyInfo) */
export interface AppUser {
  id: string;
  pushName?: string;
  name?: string;
}

/** WAHA contact info */
export interface ContactInfo {
  number: string;
  [key: string]: unknown;
}

/** WAHA user about response */
export interface UserAboutResponse {
  about?: string;
}

/** Chat picture response */
export interface ChatPictureResponse {
  url?: string;
}

/** Status update response */
export interface StatusResponse {
  success?: boolean;
}

/** WebSocket event payload envelope */
export interface WebSocketEvent {
  event: string;
  payload: Message;
}

/** IndexedDB stored media record */
export interface StoredMedia {
  reqId: string;
  blob: Blob;
  filename: string;
}

/** Downloaded media result */
export interface DownloadedMedia {
  blob: Blob;
  filename: string;
}

/** Message with _time field used during ordering compensation */
export interface MessageWithTime extends Message {
  _time: number;
}
