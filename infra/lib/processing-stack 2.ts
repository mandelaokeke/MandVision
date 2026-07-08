import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3Notifications from "aws-cdk-lib/aws-s3-notifications";

interface ProcessingStackProps extends cdk.StackProps {
  ingestBucket: s3.Bucket;
}

export class ProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

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

    const processorLambda = new lambdaNodejs.NodejsFunction(this, "MediaProcessorLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "../services/media-processor/src/handler.ts",
      handler: "main",
      timeout: cdk.Duration.seconds(30),
      environment: {
        INGEST_BUCKET_NAME: props.ingestBucket.bucketName,
      },
    });

    props.ingestBucket.grantRead(processorLambda);

    processorLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(processingQueue, {
        batchSize: 5,
      })
    );

    props.ingestBucket.addEventNotification(
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