export const env = {
  backendUrl:
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:2567",
  colyseusUrl:
    process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:2567",
};
