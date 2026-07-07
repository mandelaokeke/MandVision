#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "../lib/storage-stack";
import { ApiStack } from "../lib/api-stack";
import { ProcessingStack } from "../lib/processing-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const storageStack = new StorageStack(app, "MandImageStorageStack", {
  env,
});

new ApiStack(app, "MandImageApiStack", {
  env,
  ingestBucket: storageStack.ingestBucket,
});

//new ProcessingStack(app, "MandImageProcessingStack", {
 // env,
 // ingestBucket: storageStack.ingestBucket,
//});