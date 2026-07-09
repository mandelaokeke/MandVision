import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";

interface ApiStackProps extends cdk.StackProps {
  ingestBucket: s3.Bucket;
  processedBucket: s3.Bucket;
  metadataTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const presignLambda = new lambdaNodejs.NodejsFunction(
      this,
      "PresignUrlLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "../services/presign-url/src/handler.ts",
        handler: "main",
        environment: {
          INGEST_BUCKET_NAME: props.ingestBucket.bucketName,
        },
      }
    );

    const getMediaLambda = new lambdaNodejs.NodejsFunction(
      this,
      "GetMediaLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "../services/get-media/src/handler.ts",
        handler: "main",
        environment: {
          METADATA_TABLE_NAME: props.metadataTable.tableName,
        },
      }
    );

    const listMediaLambda = new lambdaNodejs.NodejsFunction(
      this,
      "ListMediaLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "../services/list-media/src/handler.ts",
        handler: "main",
        environment: {
          METADATA_TABLE_NAME: props.metadataTable.tableName,
        },
      }
    );

    const getPreviewUrlLambda = new lambdaNodejs.NodejsFunction(
      this,
      "GetPreviewUrlLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "../services/get-preview-url/src/handler.ts",
        handler: "main",
        environment: {
          METADATA_TABLE_NAME: props.metadataTable.tableName,
        },
      }
    );

    const deleteMediaLambda = new lambdaNodejs.NodejsFunction(
      this,
      "DeleteMediaLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "../services/delete-media/src/handler.ts",
        handler: "main",
        environment: {
          METADATA_TABLE_NAME: props.metadataTable.tableName,
        },
      }
    );

    const reprocessMediaLambda = new lambdaNodejs.NodejsFunction(
      this,
      "ReprocessMediaLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "../services/reprocess-media/src/handler.ts",
        handler: "main",
        timeout: cdk.Duration.seconds(30),
        environment: {
          METADATA_TABLE_NAME: props.metadataTable.tableName,
        },
      }
    );

    props.ingestBucket.grantPut(presignLambda);
    props.metadataTable.grantReadData(getMediaLambda);
    props.metadataTable.grantReadData(listMediaLambda);
    props.metadataTable.grantReadData(getPreviewUrlLambda);
    props.ingestBucket.grantRead(getPreviewUrlLambda);
    props.metadataTable.grantReadWriteData(deleteMediaLambda);
    props.ingestBucket.grantDelete(deleteMediaLambda);
    props.processedBucket.grantDelete(deleteMediaLambda);
    props.metadataTable.grantReadWriteData(reprocessMediaLambda);
    props.ingestBucket.grantRead(reprocessMediaLambda);
    reprocessMediaLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectLabels"],
        resources: ["*"],
      })
    );

    const api = new apigateway.RestApi(this, "MediaPipelineApi", {
      restApiName: "mand-image-processing-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const uploadUrl = api.root.addResource("upload-url");
    uploadUrl.addMethod("POST", new apigateway.LambdaIntegration(presignLambda));

    const media = api.root.addResource("media");
    media.addMethod("GET", new apigateway.LambdaIntegration(listMediaLambda));

    const mediaItem = media.addResource("{fileId}");
    mediaItem.addMethod("GET", new apigateway.LambdaIntegration(getMediaLambda));
    mediaItem.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(deleteMediaLambda)
    );

    const reprocess = mediaItem.addResource("reprocess");
    reprocess.addMethod(
      "POST",
      new apigateway.LambdaIntegration(reprocessMediaLambda)
    );

    const previewUrl = mediaItem.addResource("preview-url");
    previewUrl.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getPreviewUrlLambda)
    );

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });
  }
}
