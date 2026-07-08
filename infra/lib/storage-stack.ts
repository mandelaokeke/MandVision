import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3Notifications from "aws-cdk-lib/aws-s3-notifications";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";

interface StorageStackProps extends cdk.StackProps {
  metadataTable: dynamodb.Table;
  connectionsTable: dynamodb.Table;
  websocketApi: apigwv2.WebSocketApi;
}

export class StorageStack extends cdk.Stack {
  public readonly ingestBucket: s3.Bucket;
  public readonly processedBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
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
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
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

    const deadLetterQueue = new sqs.Queue(this, "MediaProcessingDLQ", {
      queueName: "mandvision-media-processing-dlq",
      retentionPeriod: cdk.Duration.days(14),
    });

    const processingQueue = new sqs.Queue(this, "MediaProcessingQueue", {
      queueName: "mandvision-media-processing-queue",
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const processorLambda = new lambdaNodejs.NodejsFunction(
      this,
      "MediaProcessorLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "../services/media-processor/src/handler.ts",
        handler: "main",
        timeout: cdk.Duration.seconds(30),
        environment: {
          INGEST_BUCKET_NAME: this.ingestBucket.bucketName,
          PROCESSED_BUCKET_NAME: this.processedBucket.bucketName,
          METADATA_TABLE_NAME: props.metadataTable.tableName,
          CONNECTIONS_TABLE_NAME: props.connectionsTable.tableName,
          WEBSOCKET_API_ENDPOINT: `https://${props.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/prod`,
        },
      }
    );

    this.ingestBucket.grantRead(processorLambda);
    this.processedBucket.grantWrite(processorLambda);
    props.metadataTable.grantWriteData(processorLambda);
    props.connectionsTable.grantReadData(processorLambda);
    processorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectLabels"],
        resources: ["*"],
      })
    );
    processorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${props.websocketApi.apiId}/prod/POST/@connections/*`,
        ],
      })
    );

    processorLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(processingQueue, {
        batchSize: 5,
      })
    );

    this.ingestBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.SqsDestination(processingQueue),
      { prefix: "uploads/" }
    );

    new cdk.CfnOutput(this, "ProcessingQueueUrl", {
      value: processingQueue.queueUrl,
    });

    new cdk.CfnOutput(this, "ProcessingDLQUrl", {
      value: deadLetterQueue.queueUrl,
    });
  }
}