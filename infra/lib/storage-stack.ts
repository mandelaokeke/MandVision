import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";

export class StorageStack extends cdk.Stack {
  public readonly ingestBucket: s3.Bucket;
  public readonly processedBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.ingestBucket = new s3.Bucket(this, "IngestBucket", {
      bucketName: `mand-image-ingest-${this.account}-${this.region}`,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedOrigins: ["http://localhost:3000"],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
          ],
          allowedHeaders: ["*"],
        },
      ],
    });

    this.processedBucket = new s3.Bucket(this, "ProcessedBucket", {
      bucketName: `mand-image-processed-${this.account}-${this.region}`,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}