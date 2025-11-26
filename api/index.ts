import app, { initializeApp } from "../server/app";

let isInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isInitialized) {
    await initializeApp();
    isInitialized = true;
  }
  return (app as any)(req, res);
}
