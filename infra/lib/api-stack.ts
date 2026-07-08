import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface ApiStackProps extends cdk.StackProps {
  ingestBucket: s3.Bucket;
  metadataTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const presignLambda = new lambdaNodejs.NodejsFunction(this, "PresignUrlLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "../services/presign-url/src/handler.ts",
      handler: "main",
      environment: {
        INGEST_BUCKET_NAME: props.ingestBucket.bucketName,
      },
    });

    const getMediaLambda = new lambdaNodejs.NodejsFunction(this, "GetMediaLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "../services/get-media/src/handler.ts",
      handler: "main",
      environment: {
        METADATA_TABLE_NAME: props.metadataTable.tableName,
      },
    });

    props.ingestBucket.grantPut(presignLambda);
    props.metadataTable.grantReadData(getMediaLambda);

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
    const mediaItem = media.addResource("{fileId}");
    mediaItem.addMethod("GET", new apigateway.LambdaIntegration(getMediaLambda));

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });
  }
}