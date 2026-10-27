/**
 * Node 20 n'a pas de WebSocket natif, or le client realtime de Supabase en exige un dès sa création.
 * À importer en premier dans les scripts du pool démo ; sans effet si le runtime en fournit déjà un.
 */
import { WebSocket as NodeWebSocket } from "ws";

const runtime = globalThis as { WebSocket?: unknown };
if (typeof runtime.WebSocket === "undefined") runtime.WebSocket = NodeWebSocket;
