import serverlessExpress from "@vendia/serverless-express";
import app, { initializeApp } from "../server/app";

let handler: any;

export default async function (req: any, res: any) {
  if (!handler) {
    await initializeApp();
    handler = serverlessExpress({ app });
  }
  return handler(req, res);
}
