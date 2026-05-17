import { registerBoardHandlers } from "./handlers/board.handler.js";
import { registerChatHandlers } from "./handlers/chat.handler.js";
import { registerPresenceHandlers, handleDisconnect } from "./handlers/presence.handler.js";
import { registerWhiteboardHandlers } from "./handlers/whiteboard.handler.js";

export { registerBoardHandlers, registerChatHandlers, registerPresenceHandlers, registerWhiteboardHandlers, handleDisconnect };
