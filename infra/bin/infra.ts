#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "../lib/storage-stack";
import { ApiStack } from "../lib/api-stack";
import { DatabaseStack } from "../lib/database-stack";
import { WebSocketStack } from "../lib/websocket-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const databaseStack = new DatabaseStack(app, "MandImageDatabaseStack", {
  env,
});

const websocketStack = new WebSocketStack(app, "MandImageWebSocketStack", {
  env,
});

const storageStack = new StorageStack(app, "MandImageStorageStack", {
  env,
  metadataTable: databaseStack.metadataTable,
  connectionsTable: websocketStack.connectionsTable,
  websocketApi: websocketStack.websocketApi,
});

new ApiStack(app, "MandImageApiStack", {
  env,
  ingestBucket: storageStack.ingestBucket,
  metadataTable: databaseStack.metadataTable,
});